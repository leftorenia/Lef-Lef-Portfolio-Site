export const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}
`;

function boundedInteger(value, fallback, maximum) {
  return Number.isFinite(value) ? Math.max(1, Math.min(maximum, Math.floor(value))) : fallback;
}

export function createFragmentShaderSource({ octaves = 4, splatCount = 12 } = {}) {
  const noiseSteps = boundedInteger(octaves, 4, 4);
  const trailSteps = boundedInteger(splatCount, 12, 12);
  return `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform vec2 uViewport;
uniform float uTime;
uniform vec4 uPreset; // cloud, trail displacement, star boost, moon
uniform vec4 uTrailPosition[${trailSteps}]; // normalized x/y, strength, radius in CSS pixels
uniform vec4 uTrailMotion[${trailSteps}]; // direction x/y, normalized age, reserved

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 blend = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
             mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), blend.x), blend.y);
}

float fbm(vec2 p) {
  float total = 0.0;
  float weight = 0.5;
  mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < ${noiseSteps}; i++) {
    total += noise(p) * weight;
    p = rotation * p * 2.03 + vec2(13.1, 7.7);
    weight *= 0.5;
  }
  return total;
}

vec2 curlNoise(vec2 p) {
  const float e = 0.035;
  return vec2(noise(p + vec2(0.0, e)) - noise(p - vec2(0.0, e)),
             noise(p - vec2(e, 0.0)) - noise(p + vec2(e, 0.0))) / (2.0 * e);
}

float stars(vec2 p) {
  vec2 cell = floor(p);
  vec2 offset = vec2(hash(cell + 8.3), hash(cell + 27.1));
  float distanceToStar = length(fract(p) - (0.15 + offset * 0.7));
  float presence = step(0.967, hash(cell));
  float twinkle = 0.76 + 0.12 * sin(uTime * 0.65 + hash(cell + 4.0) * 6.283);
  return presence * exp(-distanceToStar * distanceToStar * 1250.0) * twinkle;
}

void main() {
  vec2 uv = vUv;
  float aspect = uViewport.x / max(uViewport.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 drift = vec2(uTime * 0.007, -uTime * 0.003);
  vec2 displacement = vec2(0.0);
  float trailLight = 0.0;
  for (int i = 0; i < ${trailSteps}; i++) {
    vec4 point = uTrailPosition[i];
    if (point.z > 0.0) {
      vec2 delta = (uv - vec2(point.x, 1.0 - point.y)) * uViewport;
      float radius = max(point.w, 1.0);
      float influence = exp(-dot(delta, delta) / (radius * radius)) * point.z;
      vec4 motion = uTrailMotion[i];
      vec2 direction = vec2(motion.x, -motion.y);
      displacement += influence * (direction * 0.055 + curlNoise(p * 5.0 + motion.z) * 0.024);
      trailLight += influence;
    }
  }
  trailLight = 1.0 - exp(-trailLight * 0.7);
  p += displacement * uPreset.y;
  vec2 warp = vec2(fbm(p * 2.1 + drift), fbm(p * 2.1 - drift + 9.2));
  float distant = fbm(p * 2.7 + warp * 1.8 + drift);
  float middle = fbm(p * 4.4 + warp * 2.5 - drift * 0.7);
  float foreground = fbm(p * 7.2 + warp * 3.1 + drift * 0.4);
  float band = (uv.y - 0.45 - sin(uv.x * 5.0) * 0.10) * 2.6;
  float cloudBand = exp(-(band * band));
  float density = smoothstep(0.28, 0.76, distant * 0.35 + middle * 0.50 + foreground * 0.15);
  density = clamp(density + trailLight * uPreset.y * 0.18, 0.0, 1.0);
  float readability = smoothstep(0.27, 0.65, uv.x);
  float clouds = density * cloudBand * (0.12 + readability * 0.88) * uPreset.x;
  vec3 sky = mix(vec3(0.012, 0.031, 0.082), vec3(0.031, 0.082, 0.176), uv.y * 0.5);
  vec3 cloudColor = mix(vec3(0.067, 0.157, 0.333), vec3(0.427, 0.569, 0.788), smoothstep(0.32, 0.72, middle));
  cloudColor = mix(cloudColor, vec3(0.745, 0.839, 0.965), pow(density, 3.0) * 0.55);
  vec3 color = sky + cloudColor * clouds * 0.9;

  float starLight = stars(p * 115.0) + stars(p * 67.0 + 41.2) * 0.6;
  color += vec3(0.77, 0.85, 1.0) * starLight * (0.35 + readability * 0.65)
           * (1.0 - clouds * 0.65) * (1.0 + trailLight * uPreset.z * 0.8);

  vec2 moon = vec2((uv.x - 0.76) * aspect, uv.y - 0.73);
  moon = mat2(0.93, -0.37, 0.37, 0.93) * moon;
  float disc = length(moon) - 0.050;
  float cutout = length(moon - vec2(0.023, 0.009)) - 0.052;
  float crescent = max(disc, -cutout);
  float edge = 1.5 / max(uResolution.y, 1.0);
  float moonLight = 1.0 - smoothstep(-edge, edge, crescent);
  float halo = exp(-length(moon) * 16.0) * 0.10;
  color += (vec3(0.933, 0.957, 1.0) * moonLight * 0.78 + vec3(0.427, 0.569, 0.788) * halo)
           * uPreset.w * (1.0 - clouds * 0.45);
  color += vec3(0.32, 0.46, 0.68) * trailLight * uPreset.y * readability * 0.12;
  float vignette = 1.0 - smoothstep(0.3, 0.82, length((uv - 0.5) * vec2(0.8, 1.0)));
  color *= 0.72 + vignette * 0.28;
  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
}
