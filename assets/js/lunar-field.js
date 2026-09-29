import { VERTEX_SHADER_SOURCE, createFragmentShaderSource } from './lunar-shaders.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const QUALITY = {
  high: { renderScale: 0.75, octaves: 4, splatCount: 12 },
  medium: { renderScale: 0.625, octaves: 3, splatCount: 8 },
  low: { renderScale: 0.5, octaves: 2, splatCount: 4 },
};

export function getSceneMetrics({ width = 0, height = 0, devicePixelRatio = 1, mobile, reducedMotion = false, quality } = {}) {
  const safeWidth = clamp(finite(width), 0, 16384);
  const safeHeight = clamp(finite(height), 0, 16384);
  const isMobile = mobile ?? (safeWidth > 0 && safeWidth < 720);
  const tier = Object.hasOwn(QUALITY, quality) ? quality : isMobile ? 'medium' : 'high';
  const settings = QUALITY[tier];
  const pixelRatio = clamp(finite(devicePixelRatio, 1), 1, isMobile || tier === 'low' ? 1 : 1.5);
  return {
    width: safeWidth, height: safeHeight, pixelRatio, quality: tier, ...settings,
    bufferWidth: Math.min(16384, Math.round(safeWidth * pixelRatio * settings.renderScale)),
    bufferHeight: Math.min(16384, Math.round(safeHeight * pixelRatio * settings.renderScale)),
    animate: !reducedMotion && safeWidth > 0 && safeHeight > 0,
  };
}

export function getPagePreset(pageMode) {
  const presets = {
    profile: { cloudStrength: 1, trailStrength: 1, starBoost: 1, moonStrength: 1 },
    works: { cloudStrength: 0.7, trailStrength: 0.7, starBoost: 1, moonStrength: 0.35 },
    contact: { cloudStrength: 0.45, trailStrength: 0, starBoost: 1, moonStrength: 0 },
    detail: { cloudStrength: 0.6, trailStrength: 0.6, starBoost: 1, moonStrength: 0 },
  };
  return { ...(Object.hasOwn(presets, pageMode) ? presets[pageMode] : presets.profile) };
}

// Coordinates use the DOM convention (top-left origin); time is in milliseconds.
export function createPointerTrail({ limit = 12, decayMs = 2500 } = {}) {
  const capacity = clamp(Math.floor(finite(limit, 12)), 1, 12);
  const duration = Math.max(1, finite(decayMs, 2500));
  let samples = [];
  return {
    push({ x = 0, y = 0, dx = 0, dy = 0, strength = 1 } = {}, time = 0) {
      samples.push({
        x: clamp(finite(x), 0, 1), y: clamp(finite(y), 0, 1),
        dx: clamp(finite(dx), -1, 1), dy: clamp(finite(dy), -1, 1),
        strength: clamp(finite(strength), 0, 1), time: finite(time),
      });
      if (samples.length > capacity) samples.splice(0, samples.length - capacity);
    },
    sample(time = 0) {
      const timestamp = finite(time);
      samples = samples.filter(point => timestamp - point.time < duration);
      return samples.map(({ time: started, strength, ...point }) => {
        const age = clamp((timestamp - started) / duration, 0, 1);
        return { ...point, strength: strength * (1 - age) ** 2, age };
      });
    },
    clear() { samples = []; },
  };
}

function createWebGLRenderer(canvas, metrics) {
  let gl;
  try {
    gl = canvas?.getContext?.('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
  } catch {
    return null;
  }
  if (!gl) return null;

  const shaders = [];
  let program;
  let vertexArray;
  let destroyed = false;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (vertexArray) gl.deleteVertexArray(vertexArray);
    if (program) gl.deleteProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    shaders.length = 0;
  }
  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to allocate lunar shader');
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Lunar shader compilation failed: ${gl.getShaderInfoLog(shader) || 'no compiler log'}`);
    }
    return shader;
  }

  try {
    const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragment = compile(gl.FRAGMENT_SHADER, createFragmentShaderSource(metrics));
    program = gl.createProgram();
    if (!program) throw new Error('Unable to allocate lunar program');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Lunar shader link failed: ${gl.getProgramInfoLog(program) || 'no linker log'}`);
    }
    vertexArray = gl.createVertexArray();
    if (!vertexArray) throw new Error('Unable to allocate lunar vertex array');
    const uniforms = Object.fromEntries([
      'uResolution', 'uViewport', 'uTime', 'uPreset', 'uTrailPosition[0]', 'uTrailMotion[0]',
    ].map(name => [name, gl.getUniformLocation(program, name)]));
    const positions = new Float32Array(metrics.splatCount * 4);
    const motions = new Float32Array(metrics.splatCount * 4);
    return {
      resize(width, height) {
        if (destroyed) return;
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      },
      render(frame) {
        if (destroyed) return;
        positions.fill(0);
        motions.fill(0);
        frame.trail.slice(-metrics.splatCount).forEach((point, index) => {
          positions.set([point.x, point.y, point.strength, 220], index * 4);
          motions.set([point.dx, point.dy, point.age, 0], index * 4);
        });
        gl.useProgram(program);
        gl.bindVertexArray(vertexArray);
        gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.uViewport, frame.width, frame.height);
        gl.uniform1f(uniforms.uTime, frame.time);
        const preset = frame.preset;
        gl.uniform4f(uniforms.uPreset, preset.cloudStrength, preset.trailStrength, preset.starBoost, preset.moonStrength);
        gl.uniform4fv(uniforms['uTrailPosition[0]'], positions);
        gl.uniform4fv(uniforms['uTrailMotion[0]'], motions);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      destroy,
    };
  } catch (error) {
    destroy();
    throw error;
  }
}

export function createLunarScene(canvas, options = {}) {
  const windowTarget = options.windowTarget ?? (typeof window === 'undefined' ? undefined : window);
  const documentTarget = options.documentTarget ?? (typeof document === 'undefined' ? undefined : document);
  const requestFrame = options.requestFrame ?? windowTarget?.requestAnimationFrame?.bind(windowTarget) ?? (() => null);
  const cancelFrame = options.cancelFrame ?? windowTarget?.cancelAnimationFrame?.bind(windowTarget) ?? (() => {});
  const now = options.now ?? (() => globalThis.performance?.now?.() ?? Date.now());
  const fallbackElement = options.fallbackElement ?? documentTarget?.querySelector?.('.lunar-fallback');
  const reducedMotion = options.reducedMotion ?? options.motionQuery?.matches ?? false;
  const rect = canvas?.getBoundingClientRect?.();
  const metrics = getSceneMetrics({
    width: rect?.width ?? windowTarget?.innerWidth,
    height: rect?.height ?? windowTarget?.innerHeight,
    devicePixelRatio: windowTarget?.devicePixelRatio,
    mobile: options.mobile, quality: options.quality, reducedMotion,
  });
  const preset = getPagePreset(options.pageMode);
  const trail = createPointerTrail({ limit: metrics.splatCount });
  const started = now();
  let renderer;
  let frameId = null;
  let destroyed = false;
  let fallback = true;
  let reported = false;

  function showFallback(value) {
    fallback = value;
    if (fallbackElement) fallbackElement.hidden = !value;
    if (canvas?.style) canvas.style.visibility = value ? 'hidden' : 'visible';
  }
  function stop() {
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
  }
  function fail(error) {
    stop();
    renderer?.destroy();
    renderer = null;
    showFallback(true);
    if (error && !reported) {
      reported = true;
      if (options.onError) options.onError(error);
      else globalThis.console?.warn?.('Lunar field unavailable; using static background.', error);
    }
  }
  function render(time = 0) {
    if (destroyed || !renderer) return;
    try {
      renderer.render({ width: metrics.width, height: metrics.height, time, metrics, preset, trail: trail.sample(now()) });
      showFallback(false);
    } catch (error) { fail(error); }
  }
  function tick(timestamp) {
    frameId = null;
    if (destroyed || fallback || !metrics.animate) return;
    render(Math.max(0, finite(timestamp, now()) - started) / 1000);
    if (!fallback) frameId = requestFrame(tick);
  }
  showFallback(true);
  try {
    renderer = (options.rendererFactory ?? createWebGLRenderer)(canvas, metrics);
    if (renderer) {
      renderer.resize(metrics.bufferWidth, metrics.bufferHeight);
      render();
      if (!fallback && metrics.animate && documentTarget?.hidden !== true) frameId = requestFrame(tick);
    }
  } catch (error) { fail(error); }

  return {
    get fallback() { return fallback; },
    get metrics() { return metrics; },
    renderStatic() { render(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      trail.clear();
      renderer?.destroy();
      renderer = null;
      showFallback(true);
    },
  };
}

export function bootLunarField(root, windowTarget) {
  if (!root?.body) return null;
  let canvas = root.getElementById?.('lunar-field');
  if (!canvas) {
    canvas = root.createElement?.('canvas');
    if (!canvas) return null;
    canvas.id = 'lunar-field';
    root.body.prepend?.(canvas);
  }
  canvas.setAttribute?.('aria-hidden', 'true');
  const motionQuery = windowTarget?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const page = root.body.dataset?.page;
  return createLunarScene(canvas, {
    windowTarget, documentTarget: root, motionQuery,
    pageMode: page === 'work-detail' ? 'detail' : page,
  });
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootLunarField(document, window), { once: true });
  } else {
    bootLunarField(document, window);
  }
}
