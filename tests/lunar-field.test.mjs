import test from 'node:test';
import assert from 'node:assert/strict';
import { bootLunarField, createLunarScene, createPointerTrail, getPagePreset, getSceneMetrics } from '../assets/js/lunar-field.js';
import { VERTEX_SHADER_SOURCE, createFragmentShaderSource } from '../assets/js/lunar-shaders.js';

test('desktop buffers cap DPR and apply high quality render scale', () => {
  const high = getSceneMetrics({ width: 1440, height: 1000, devicePixelRatio: 3, mobile: false, reducedMotion: false });
  assert.equal(high.pixelRatio, 1.5);
  assert.equal(high.quality, 'high');
  assert.equal(high.renderScale, 0.75);
  assert.equal(high.octaves, 4);
  assert.equal(high.splatCount, 12);
  assert.equal(high.meteorCount, 5);
  assert.equal(high.animate, true);
  assert.equal(high.bufferWidth, 1620);
  assert.equal(high.bufferHeight, 1125);
});

test('mobile buffers use medium quality and a one DPR cap', () => {
  const mobile = getSceneMetrics({ width: 390, height: 844, devicePixelRatio: 3, mobile: true });
  assert.equal(mobile.pixelRatio, 1);
  assert.equal(mobile.quality, 'medium');
  assert.equal(mobile.renderScale, 0.625);
  assert.equal(mobile.octaves, 3);
  assert.equal(mobile.splatCount, 8);
  assert.equal(mobile.meteorCount, 4);
  assert.equal(mobile.bufferWidth, 244);
  assert.equal(mobile.bufferHeight, 528);
});

test('low quality remains available for subsequent adaptive downgrade', () => {
  const low = getSceneMetrics({ width: 1000, height: 500, quality: 'low', devicePixelRatio: 3 });
  assert.equal(low.pixelRatio, 1);
  assert.equal(low.renderScale, 0.5);
  assert.equal(low.octaves, 2);
  assert.equal(low.splatCount, 4);
  assert.equal(low.meteorCount, 3);
  assert.equal(low.bufferWidth, 500);
});

test('empty or invalid dimensions cannot produce nonfinite buffers or animation', () => {
  for (const width of [0, -2, NaN, Infinity]) {
    const metrics = getSceneMetrics({ width, height: 0, devicePixelRatio: NaN });
    for (const value of [metrics.bufferWidth, metrics.bufferHeight, metrics.pixelRatio]) {
      assert.ok(Number.isFinite(value) && value >= 0);
    }
    assert.equal(metrics.animate, false);
  }
  assert.equal(getSceneMetrics({ width: 100, height: 100, reducedMotion: true }).animate, false);
});

test('page presets only control clouds, trails, and stars', () => {
  assert.deepEqual(getPagePreset('contact'), { cloudStrength: 0.45, trailStrength: 0, starBoost: 1 });
  assert.deepEqual(getPagePreset('profile'), { cloudStrength: 1, trailStrength: 1, starBoost: 1 });
  assert.deepEqual(getPagePreset('works'), { cloudStrength: 0.7, trailStrength: 0.7, starBoost: 1 });
  assert.deepEqual(getPagePreset('detail'), { cloudStrength: 0.6, trailStrength: 0.6, starBoost: 1 });
  assert.deepEqual(getPagePreset('unknown'), getPagePreset('profile'));
});

test('background shader contains no moon disc, crescent, or halo rendering', () => {
  const source = createFragmentShaderSource();
  assert.doesNotMatch(source, /\b(?:moon|crescent|cutout)\b/i);
  assert.doesNotMatch(source, /uPreset\.w/);
});

test('shader variants emit GLSL ES 3 with compile-time noise and trail bounds', () => {
  const source = createFragmentShaderSource({ octaves: 3, splatCount: 8 });
  assert.match(VERTEX_SHADER_SOURCE, /^#version 300 es/);
  assert.match(source, /^#version 300 es/);
  assert.match(source, /uTrailPosition\[8\]/);
  assert.match(source, /uTrailMotion\[8\]/);
  assert.match(source, /i < 3/);
  assert.match(source, /i < 8/);
  assert.doesNotMatch(createFragmentShaderSource({ octaves: NaN, splatCount: Infinity }), /NaN|Infinity/);
});

test('shader gives ambient stars a wider, slightly faster twinkle', () => {
  const source = createFragmentShaderSource({ octaves: 3, splatCount: 8 });
  const values = source.match(
    /float\s+twinkle\s*=\s*([0-9.]+)\s*\+\s*([0-9.]+)\s*\*\s*sin\(uTime\s*\*\s*([0-9.]+)/,
  )?.slice(1).map(Number);
  assert.ok(values, 'shader must expose the star twinkle envelope');
  const [base, amplitude, speed] = values;
  assert.ok(base - amplitude >= 0 && base - amplitude <= 0.5, 'twinkle needs a visible dim phase');
  assert.ok(base + amplitude >= 1, 'twinkle needs a bright peak');
  assert.ok(speed >= 0.8, 'twinkle needs a slightly quicker pulse');
});

test('shader strongly boosts stars around active pointer trails', () => {
  const source = createFragmentShaderSource({ octaves: 3, splatCount: 8 });
  const pointerBoost = Number(source.match(
    /\(1\.0\s*\+\s*trailLight\s*\*\s*uPreset\.z\s*\*\s*([0-9.]+)\)/,
  )?.[1]);
  assert.ok(pointerBoost >= 4, 'the tighter pointer trail needs a strongly emphasized local star boost');
});

test('meteor shower scales by quality and travels from upper-right to lower-left', () => {
  for (const meteorCount of [5, 4, 3]) {
    const source = createFragmentShaderSource({ meteorCount });
    assert.match(source, new RegExp(`for \\(int meteor = 0; meteor < ${meteorCount}; meteor\\+\\+\\)`));
  }
  const source = createFragmentShaderSource({ meteorCount: 5 });
  const direction = source.match(
    /const\s+vec2\s+meteorDirection\s*=\s*normalize\(vec2\(\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)\s*\)\)/,
  )?.slice(1).map(Number);
  assert.ok(direction, 'shader must expose a fixed meteor travel direction');
  assert.ok(direction[0] < 0 && direction[1] < 0, 'meteors must move left and down in UV space');
  assert.ok(Math.abs(direction[1] / direction[0] - 0.74) < 0.02, 'meteor angle must match the reference image');
  assert.doesNotMatch(createFragmentShaderSource({ meteorCount: Infinity }), /NaN|Infinity/);
});

test('meteor cadence keeps multiple emitters evenly staggered across time at every quality', () => {
  for (const meteorCount of [5, 4, 3]) {
    const source = createFragmentShaderSource({ meteorCount });
    const cadence = Number(source.match(/const\s+float\s+meteorCadence\s*=\s*([0-9.]+)/)?.[1]);
    assert.ok(cadence > 0, 'shader must expose one shared cadence');
    assert.match(
      source,
      new RegExp(`float\\s+phase\\s*=\\s*fract\\(uTime\\s*\\*\\s*meteorCadence\\s*\\+\\s*index\\s*\\/\\s*float\\(${meteorCount}\\)\\)`),
    );
    for (let time = 0; time <= 120; time += 0.125) {
      const active = Array.from({ length: meteorCount }, (_, index) =>
        (time * cadence + index / meteorCount) % 1,
      ).filter(phase => phase >= 0.07 && phase <= 0.9).length;
      assert.ok(active >= 2, `${meteorCount} meteors must keep at least two emitters active at ${time}s`);
    }
  }
});

test('clouds softly occlude the meteor shower', () => {
  const source = createFragmentShaderSource({ meteorCount: 5 });
  const occlusion = Number(source.match(
    /float\s+meteorVisibility\s*=\s*1\.0\s*-\s*clouds\s*\*\s*([0-9.]+)/,
  )?.[1]);
  assert.ok(occlusion > 0 && occlusion < 1, 'cloud cover must partially hide, not erase, meteors');
  assert.match(source, /meteorColor\s*\*\s*meteorVisibility/);
});

test('meteor silhouette has a long tapered core, diffuse haze, and layered head', () => {
  const source = createFragmentShaderSource({ meteorCount: 5 });
  const trailBounds = source.match(
    /float\s+trailLength\s*=\s*mix\(\s*([0-9.]+)\s*,\s*([0-9.]+)/,
  )?.slice(1).map(Number);
  assert.ok(trailBounds, 'shader must expose the reference-length trail range');
  assert.ok(trailBounds[0] >= 0.45 && trailBounds[1] >= 0.75, 'trail must remain long and slender');
  for (const layer of ['trailProgress', 'taperedWidth', 'tailCore', 'tailHaze', 'headCore', 'headComa', 'headHalo']) {
    assert.match(source, new RegExp(`float\\s+${layer}\\s*=`), `shader must define ${layer}`);
  }
  const widths = source.match(
    /float\s+baseWidth\s*=\s*mix\(\s*([0-9.]+)[^;]+;[\s\S]*?float\s+taperedWidth\s*=\s*mix\(baseWidth,\s*([0-9.]+)/,
  )?.slice(1).map(Number);
  assert.ok(widths && widths[1] < widths[0], 'the bright core must narrow toward the trail tip');
  const meteorSample = source.match(/vec3\s+meteorSample\s*=([\s\S]*?);/)?.[1] ?? '';
  for (const layer of ['tailCore', 'tailHaze', 'headCore', 'headComa', 'headHalo']) {
    assert.match(meteorSample, new RegExp(`\\b${layer}\\b`), `${layer} must contribute to the final meteor`);
  }
  assert.doesNotMatch(source, /meteorScale/, 'reference silhouette must not use uniform three-axis scaling');
});

test('meteor shader culls distant fragments before expensive layered falloff', () => {
  const source = createFragmentShaderSource({ meteorCount: 5 });
  const boundsAt = source.indexOf('float meteorBounds');
  const progressAt = source.indexOf('float trailProgress');
  assert.ok(boundsAt >= 0 && boundsAt < progressAt, 'cheap bounds must run before fractional powers and exponentials');
  assert.match(source, /if\s*\([^)]*along[^)]*across[^)]*\)\s*continue\s*;/s);
});

test('meteor glow grades from a white core into desaturated ice blue and compresses overlap', () => {
  const source = createFragmentShaderSource({ meteorCount: 5 });
  const readColor = name => source.match(
    new RegExp(`const\\s+vec3\\s+${name}\\s*=\\s*vec3\\(\\s*([0-9.]+)\\s*,\\s*([0-9.]+)\\s*,\\s*([0-9.]+)\\s*\\)`),
  )?.slice(1).map(Number);
  const core = readColor('meteorCoreColor');
  const haze = readColor('meteorHazeColor');
  assert.ok(core?.every(channel => channel >= 0.95), 'meteor core must be near-white');
  assert.ok(haze && haze[2] > haze[1] && haze[1] > haze[0], 'outer glow must be desaturated ice blue');
  assert.ok(haze[2] - haze[0] < 0.65, 'outer glow must avoid saturated cyan or electric blue');
  assert.match(source, /vec3\s+meteorColor\s*=\s*vec3\(0\.0\)/);
  assert.match(source, /return\s+1\.0\s*-\s*exp\(-meteorColor\)/, 'overlapping meteors must use soft energy compression');
});

test('cloud band squares its signed offset without undefined negative-base GLSL pow', () => {
  for (const [octaves, splatCount] of [[4, 12], [3, 8], [2, 4]]) {
    const source = createFragmentShaderSource({ octaves, splatCount });
    const cloudBand = source.match(/float\s+cloudBand\s*=\s*([^;]+);/)?.[1];
    assert.ok(cloudBand, 'shader must define its cloud band');
    assert.doesNotMatch(cloudBand, /\bpow\s*\(/, 'signed band offsets cannot be passed to GLSL pow');
    assert.match(source, /float\s+band\s*=\s*\(uv\.y\s*-\s*0\.45\s*-\s*sin\(uv\.x\s*\*\s*5\.0\)\s*\*\s*0\.10\)\s*\*\s*2\.6\s*;/);
    assert.match(cloudBand, /^exp\(\s*-\s*\(\s*band\s*\*\s*band\s*\)\s*\)$/);
  }
});

test('pointer trail is bounded, normalized, and fully decays at its deadline', () => {
  const trail = createPointerTrail({ limit: 2, decayMs: 2500 });
  trail.push({ x: 0, y: 0, strength: 1 }, 0);
  trail.push({ x: 0.5, y: 0.25, strength: 1 }, 100);
  trail.push({ x: 2, y: -1, dx: 4, dy: -4, strength: 3 }, 200);
  const samples = trail.sample(200);
  assert.equal(samples.length, 2);
  assert.equal(samples[0].x, 0.5);
  assert.deepEqual(samples[1], { x: 1, y: 0, dx: 1, dy: -1, strength: 1, age: 0 });
  assert.ok(trail.sample(1450)[1].strength < 1);
  assert.deepEqual(trail.sample(2700), []);
  trail.push({ x: 0.5, y: 0.5 }, 3000);
  trail.clear();
  assert.deepEqual(trail.sample(3000), []);
});

test('default pointer trail expires after two seconds', () => {
  const trail = createPointerTrail();
  trail.push({ x: 0.5, y: 0.5, strength: 1 }, 0);
  assert.equal(trail.sample(1999).length, 1);
  assert.deepEqual(trail.sample(2000), []);
});

function canvasWith(context = null) {
  return {
    width: 0, height: 0, style: {},
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
    getContext(type) { assert.equal(type, 'webgl2'); return context; },
    setAttribute() {},
  };
}

test('missing or throwing WebGL2 leaves fallback visible with safe cleanup', () => {
  for (const canvas of [undefined, canvasWith(), { getContext() { throw new Error('disabled'); } }]) {
    const fallbackElement = { hidden: false };
    const scene = createLunarScene(canvas, { fallbackElement });
    assert.equal(scene.fallback, true);
    assert.equal(fallbackElement.hidden, false);
    assert.doesNotThrow(() => { scene.renderStatic(); scene.destroy(); scene.destroy(); });
  }
  assert.equal(bootLunarField(undefined, undefined), null);
});

test('reduced motion renders a static frame without requesting RAF and destroys once', () => {
  const frames = [];
  const sizes = [];
  let destroys = 0;
  const fallbackElement = { hidden: false };
  const scene = createLunarScene(canvasWith(), {
    reducedMotion: true, pageMode: 'contact', fallbackElement,
    rendererFactory: (_canvas, metrics) => {
      assert.equal(metrics.splatCount, 12);
      return { render: frame => frames.push(frame), resize: (...size) => sizes.push(size), destroy() { destroys++; } };
    },
    now: () => 500,
    requestFrame() { assert.fail('reduced motion must not request RAF'); },
  });
  assert.equal(scene.fallback, false);
  assert.equal(fallbackElement.hidden, true);
  assert.deepEqual(sizes, [[600, 450]]);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].time, 0);
  assert.equal(frames[0].preset.trailStrength, 0);
  scene.destroy();
  scene.destroy();
  scene.renderStatic();
  assert.equal(destroys, 1);
  assert.equal(frames.length, 1);
  assert.equal(fallbackElement.hidden, false);
});

test('normal motion advances frame time and cancellation makes stale callbacks harmless', () => {
  let callback;
  const frames = [];
  const cancelled = [];
  const scene = createLunarScene(canvasWith(), {
    now: () => 1000,
    rendererFactory: () => ({ render: frame => frames.push(frame), resize() {}, destroy() {} }),
    requestFrame(fn) { callback = fn; return 7; },
    cancelFrame: id => cancelled.push(id),
  });
  callback(2000);
  assert.equal(frames.at(-1).time, 1);
  scene.destroy();
  callback(3000);
  assert.equal(frames.length, 2);
  assert.deepEqual(cancelled, [7]);
});

// Node has no GPU; this boundary double tracks ownership of real renderer resources.
function glFixture({ compileFailure = 0, linkFailure = false } = {}) {
  const allocated = new Set();
  const deleted = [];
  const draws = [];
  const uniforms = new Map();
  let shaderCount = 0;
  const allocate = kind => { const item = { kind }; allocated.add(item); return item; };
  const release = item => { assert.ok(allocated.delete(item), 'resource deleted exactly once'); deleted.push(item); };
  return {
    allocated, deleted, draws, uniforms,
    VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, COMPILE_STATUS: 35713, LINK_STATUS: 35714, TRIANGLES: 4,
    createShader() { const shader = allocate('shader'); shader.number = ++shaderCount; return shader; },
    shaderSource(shader, source) { shader.source = source; }, compileShader() {},
    getShaderParameter: shader => shader.number !== compileFailure,
    getShaderInfoLog: () => 'test compile failure', deleteShader: release,
    createProgram: () => allocate('program'), attachShader() {}, linkProgram() {},
    getProgramParameter: () => !linkFailure, getProgramInfoLog: () => 'test link failure', deleteProgram: release,
    createVertexArray: () => allocate('vao'), bindVertexArray() {}, deleteVertexArray: release,
    getUniformLocation: (_program, name) => name,
    useProgram() {}, viewport() {},
    uniform1f: (name, value) => uniforms.set(name, value),
    uniform2f: (name, ...value) => uniforms.set(name, value),
    uniform3f: (name, ...value) => uniforms.set(name, value),
    uniform4f: (name, ...value) => uniforms.set(name, value),
    uniform4fv: (name, value) => uniforms.set(name, Array.from(value)),
    drawArrays: (...args) => draws.push(args),
  };
}

for (const failure of [{ compileFailure: 1 }, { compileFailure: 2 }, { linkFailure: true }]) {
  test(`shader failure ${JSON.stringify(failure)} frees partial resources and reports once`, () => {
    const gl = glFixture(failure);
    const warnings = [];
    const fallbackElement = { hidden: false };
    const scene = createLunarScene(canvasWith(gl), { fallbackElement, onError: error => warnings.push(error) });
    assert.equal(scene.fallback, true);
    assert.equal(fallbackElement.hidden, false);
    assert.equal(gl.allocated.size, 0);
    assert.equal(warnings.length, 1);
    scene.destroy();
    assert.equal(warnings.length, 1);
  });
}

test('default renderer draws a full-screen triangle and releases every GPU resource', () => {
  const gl = glFixture();
  const canvas = canvasWith(gl);
  const scene = createLunarScene(canvas, { reducedMotion: true, pageMode: 'contact' });
  assert.equal(scene.fallback, false);
  assert.deepEqual(gl.draws, [[4, 0, 3]]);
  assert.deepEqual(gl.uniforms.get('uPreset'), [0.45, 0, 1]);
  assert.equal(gl.uniforms.get('uTrailPosition[0]').length, 48);
  assert.equal(canvas.width, 600);
  assert.equal(canvas.height, 450);
  scene.destroy();
  scene.destroy();
  assert.equal(gl.allocated.size, 0);
});

test('default renderer sends a 100px pointer influence radius to the GPU', () => {
  const gl = glFixture();
  const windowTarget = eventTarget({ innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 });
  const documentTarget = eventTarget({ hidden: false });
  const motionQuery = eventTarget({ matches: false });
  const canvas = eventTarget(canvasWith(gl));
  let frameCallback;
  let time = 0;
  const scene = createLunarScene(canvas, {
    windowTarget, documentTarget, motionQuery, now: () => time,
    requestFrame(callback) { frameCallback = callback; return 1; },
    cancelFrame() {},
  });
  windowTarget.emit('pointermove', { clientX: 400, clientY: 300 });
  time = 16;
  frameCallback(time);
  assert.equal(gl.uniforms.get('uTrailPosition[0]')[3], 100);
  scene.destroy();
});

test('boot maps work-detail to the detail preset and marks a generated canvas decorative', () => {
  const gl = glFixture();
  const canvas = canvasWith(gl);
  const attributes = new Map();
  canvas.setAttribute = (name, value) => attributes.set(name, value);
  const children = [];
  const fallbackElement = { hidden: false };
  const root = {
    body: { dataset: { page: 'work-detail' }, prepend: child => children.push(child) },
    getElementById: () => null, createElement: () => canvas,
    querySelector: () => fallbackElement,
  };
  const scene = bootLunarField(root, { matchMedia: () => ({ matches: true }) });
  assert.equal(scene.fallback, false);
  assert.deepEqual(children, [canvas]);
  assert.equal(canvas.id, 'lunar-field');
  assert.equal(attributes.get('aria-hidden'), 'true');
  assert.deepEqual(gl.uniforms.get('uPreset'), [0.6, 0.6, 1]);
  scene.destroy();
});

// Browser events and GPU rendering are external boundaries; scene behavior stays real.
function eventTarget(properties = {}) {
  const listeners = new Map();
  return {
    ...properties, listeners,
    addEventListener(type, handler, options) {
      const entries = listeners.get(type) ?? [];
      entries.push({ handler, options });
      listeners.set(type, entries);
    },
    removeEventListener(type, handler) {
      listeners.set(type, (listeners.get(type) ?? []).filter(entry => entry.handler !== handler));
    },
    emit(type, event = {}) {
      for (const { handler } of [...(listeners.get(type) ?? [])]) handler(event);
    },
  };
}

function lifecycleFixture({ reducedMotion = false, hidden = false } = {}) {
  let time = 0;
  let id = 0;
  const pending = new Map();
  const cancelled = [];
  const renderers = [];
  const windowTarget = eventTarget({ innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 });
  const documentTarget = eventTarget({ hidden });
  const motionQuery = eventTarget({ matches: reducedMotion });
  const canvas = eventTarget(canvasWith());
  const fallbackElement = { hidden: false };
  const scene = createLunarScene(canvas, {
    windowTarget, documentTarget, motionQuery, fallbackElement, now: () => time,
    requestFrame(callback) { pending.set(++id, callback); return id; },
    cancelFrame(frameId) { cancelled.push(frameId); pending.delete(frameId); },
    rendererFactory(_canvas, metrics) {
      const renderer = {
        quality: metrics.quality, frames: [], sizes: [], destroys: 0,
        render(frame) { this.frames.push(frame); },
        resize(...size) { this.sizes.push(size); },
        destroy() { this.destroys++; },
      };
      renderers.push(renderer);
      return renderer;
    },
  });
  return {
    scene, canvas, windowTarget, documentTarget, motionQuery, fallbackElement, pending, cancelled, renderers,
    setTime(value) { time = value; },
    frame(duration = 16) {
      time += duration;
      assert.equal(pending.size, 1, 'exactly one active RAF');
      const [frameId, callback] = pending.entries().next().value;
      pending.delete(frameId);
      callback(time);
    },
  };
}

test('passive pointer and touch movement clamps splats without preventing scrolling, then decays', () => {
  const f = lifecycleFixture();
  assert.deepEqual(f.windowTarget.listeners.get('pointermove')?.[0].options, { passive: true });
  const move = (clientX, clientY, pointerType = 'mouse') => f.windowTarget.emit('pointermove', {
    clientX, clientY, pointerType, preventDefault() { assert.fail('input must not prevent scrolling'); },
  });
  move(-100, 1200);
  f.frame();
  assert.equal(f.renderers[0].frames.at(-1).trail[0].x, 0);
  assert.equal(f.renderers[0].frames.at(-1).trail[0].y, 1);
  move(400, 150, 'touch');
  f.frame();
  const point = f.renderers[0].frames.at(-1).trail.at(-1);
  assert.equal(point.x, 0.5);
  assert.equal(point.y, 0.25);
  assert.ok(point.strength > 0 && point.strength <= 1);
  assert.ok(point.dx > 0 && point.dx <= 1);
  assert.ok(point.dy < 0 && point.dy >= -1);
  for (let i = 0; i < 20; i++) move(i * 10000, -i * 10000, 'touch');
  f.frame();
  assert.equal(f.renderers[0].frames.at(-1).trail.length, 12);
  for (const splat of f.renderers[0].frames.at(-1).trail) {
    assert.ok(Object.values(splat).every(Number.isFinite));
    assert.ok(Math.abs(splat.dx) <= 1 && Math.abs(splat.dy) <= 1);
  }
  f.frame(2500);
  assert.deepEqual(f.renderers[0].frames.at(-1).trail, []);
  f.scene.destroy();
});

test('alternating 16ms and 33ms frames downgrade once per full 90-frame average and never upgrade', () => {
  const f = lifecycleFixture();
  const run = (count) => { for (let i = 0; i < count; i++) f.frame(i % 2 === 0 ? 16 : 33); };
  run(89);
  assert.equal(f.scene.metrics.quality, 'high');
  f.frame(33);
  assert.equal(f.scene.metrics.quality, 'medium');
  assert.equal(f.renderers.length, 2);
  assert.equal(f.renderers[0].destroys, 1);
  assert.deepEqual(f.renderers[1].sizes, [[500, 375]]);
  run(89);
  assert.equal(f.scene.metrics.quality, 'medium');
  f.frame(33);
  assert.equal(f.scene.metrics.quality, 'low');
  assert.equal(f.renderers.length, 3);
  assert.equal(f.renderers[1].destroys, 1);
  assert.deepEqual(f.renderers[2].sizes, [[400, 300]]);
  run(720);
  for (let i = 0; i < 100; i++) f.frame(16);
  f.windowTarget.emit('resize');
  assert.equal(f.scene.metrics.quality, 'low');
  assert.equal(f.renderers.length, 3);
  f.scene.destroy();
});

test('quality uses a bounded rolling window and only downgrades above the 22ms mean', () => {
  const f = lifecycleFixture();
  for (let i = 0; i < 45; i++) f.frame(28);
  for (let i = 0; i < 45; i++) f.frame(16);
  assert.equal(f.scene.metrics.quality, 'high', 'a full window averaging exactly 22ms is allowed');
  for (let i = 0; i < 45; i++) f.frame(28);
  assert.equal(f.scene.metrics.quality, 'high', 'old 28ms samples must leave the window');
  f.frame(28);
  assert.equal(f.scene.metrics.quality, 'medium', 'replacing one 16ms sample crosses the mean threshold');
  for (let i = 0; i < 89; i++) f.frame(22);
  assert.equal(f.scene.metrics.quality, 'medium', 'downgrade must clear all previous samples');
  f.frame(22);
  assert.equal(f.scene.metrics.quality, 'medium', 'the next complete 22ms window stays at medium');
  f.frame(23);
  assert.equal(f.scene.metrics.quality, 'low');
  assert.deepEqual(f.renderers.map(renderer => renderer.sizes.length), [1, 1, 1]);
  f.scene.destroy();
});

test('visibility pauses and resize reset the measurement window without counting inactive time', () => {
  const f = lifecycleFixture();
  for (let i = 0; i < 89; i++) f.frame(24);
  f.documentTarget.hidden = true;
  f.documentTarget.emit('visibilitychange');
  f.setTime(100000);
  f.documentTarget.hidden = false;
  f.documentTarget.emit('visibilitychange');
  for (let i = 0; i < 89; i++) f.frame(24);
  assert.equal(f.scene.metrics.quality, 'high');
  f.windowTarget.emit('resize');
  for (let i = 0; i < 89; i++) f.frame(24);
  assert.equal(f.scene.metrics.quality, 'high');
  f.frame(24);
  assert.equal(f.scene.metrics.quality, 'medium');
  f.scene.destroy();
});

test('reduced motion redraws resize and live preferences without retaining pointer motion', () => {
  const f = lifecycleFixture({ reducedMotion: true });
  assert.equal(f.pending.size, 0);
  assert.equal(f.renderers[0].frames.length, 1);
  f.windowTarget.innerWidth = 1000;
  f.windowTarget.innerHeight = 500;
  f.windowTarget.devicePixelRatio = 3;
  f.windowTarget.emit('resize');
  assert.deepEqual(f.renderers[0].sizes.at(-1), [1125, 563]);
  assert.equal(f.renderers[0].frames.length, 2);
  assert.equal(f.pending.size, 0);
  f.motionQuery.emit('change', { matches: false });
  assert.equal(f.scene.metrics.animate, true);
  assert.equal(f.renderers[0].frames.length, 3);
  assert.equal(f.pending.size, 1);
  f.windowTarget.emit('pointermove', { clientX: 500, clientY: 200 });
  f.frame();
  assert.equal(f.renderers[0].frames.at(-1).trail.length, 1);
  f.motionQuery.emit('change', { matches: true });
  f.windowTarget.emit('pointermove', { clientX: 700, clientY: 300 });
  f.scene.renderStatic();
  assert.equal(f.pending.size, 0);
  assert.equal(f.renderers[0].frames.at(-1).time, 0);
  assert.deepEqual(f.renderers[0].frames.at(-1).trail, []);
  f.scene.destroy();
});

test('hidden documents pause RAF and stale callbacks cannot duplicate a resumed loop', () => {
  const f = lifecycleFixture();
  const stale = f.pending.values().next().value;
  f.documentTarget.hidden = true;
  f.documentTarget.emit('visibilitychange');
  assert.equal(f.pending.size, 0);
  assert.equal(f.cancelled.length, 1);
  f.documentTarget.hidden = false;
  f.documentTarget.emit('visibilitychange');
  f.documentTarget.emit('visibilitychange');
  stale(5000);
  assert.equal(f.pending.size, 1);
  assert.equal(f.renderers[0].frames.length, 1);
  f.frame();
  f.motionQuery.emit('change', { matches: true });
  f.documentTarget.hidden = true;
  f.documentTarget.emit('visibilitychange');
  f.documentTarget.hidden = false;
  f.documentTarget.emit('visibilitychange');
  assert.equal(f.pending.size, 0);
  f.scene.destroy();
});

test('context loss enables fallback and repeated restoration creates exactly one active renderer', () => {
  const f = lifecycleFixture();
  const stale = f.pending.values().next().value;
  let prevented = 0;
  f.canvas.emit('webglcontextlost', { preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
  assert.equal(f.pending.size, 0);
  assert.equal(f.scene.fallback, true);
  assert.equal(f.fallbackElement.hidden, false);
  assert.equal(f.renderers[0].destroys, 1);
  f.windowTarget.emit('resize');
  f.documentTarget.emit('visibilitychange');
  assert.equal(f.renderers.length, 1);
  f.canvas.emit('webglcontextrestored');
  f.canvas.emit('webglcontextrestored');
  stale(1000);
  assert.equal(f.renderers.length, 2);
  assert.equal(f.renderers[1].destroys, 0);
  assert.equal(f.scene.fallback, false);
  assert.equal(f.pending.size, 1);
  assert.equal(f.renderers[1].frames.length, 1);
  f.scene.destroy();
  assert.equal(f.renderers[1].destroys, 1);
});

test('destroy removes every lifecycle listener and makes queued events harmless', () => {
  const f = lifecycleFixture();
  const targets = [f.windowTarget, f.documentTarget, f.motionQuery, f.canvas];
  assert.deepEqual(targets.map(target => [...target.listeners.keys()]), [
    ['pointermove', 'resize'], ['visibilitychange'], ['change'], ['webglcontextlost', 'webglcontextrestored'],
  ]);
  const callbacks = targets.flatMap(target => [...target.listeners.values()].flat().map(entry => entry.handler));
  const stale = f.pending.values().next().value;
  f.scene.destroy();
  f.scene.destroy();
  for (const target of targets) assert.ok([...target.listeners.values()].every(entries => entries.length === 0));
  for (const callback of callbacks) callback({ matches: false, preventDefault() {} });
  stale(10000);
  assert.equal(f.pending.size, 0);
  assert.equal(f.renderers.length, 1);
  assert.equal(f.renderers[0].destroys, 1);
  assert.equal(f.renderers[0].frames.length, 1);
});

test('zero viewport dimensions pause rendering and a valid resize resumes the same renderer', () => {
  const f = lifecycleFixture();
  f.windowTarget.innerWidth = 0;
  f.windowTarget.innerHeight = 0;
  f.windowTarget.emit('resize');
  assert.equal(f.scene.metrics.animate, false);
  assert.equal(f.pending.size, 0);
  f.windowTarget.innerWidth = 800;
  f.windowTarget.innerHeight = 600;
  f.windowTarget.emit('resize');
  assert.equal(f.scene.metrics.animate, true);
  assert.equal(f.pending.size, 1);
  assert.equal(f.renderers.length, 1);
  f.scene.destroy();
});

test('repeated startup reuses the active canvas scene and permits restart after destroy', () => {
  const f = lifecycleFixture();
  const root = { body: { dataset: {} }, getElementById: () => f.canvas };
  assert.equal(bootLunarField(root, f.windowTarget), f.scene);
  assert.equal(f.pending.size, 1);
  assert.equal(f.windowTarget.listeners.get('pointermove').length, 1);
  f.scene.destroy();
  const restarted = createLunarScene(f.canvas, { reducedMotion: true });
  assert.notEqual(restarted, f.scene);
  restarted.destroy();
});

test('resize and quality recreation preserve the animated scene time', () => {
  const f = lifecycleFixture();
  f.frame(1000);
  f.windowTarget.emit('resize');
  assert.equal(f.renderers[0].frames.at(-1).time, 1, 'resize must not jump the clouds back to startup');
  for (let i = 0; i < 90; i++) f.frame(23);
  assert.equal(f.renderers[1].frames[0].time, 3.07, 'quality replacement must keep the same animation clock');
  f.scene.destroy();
});
