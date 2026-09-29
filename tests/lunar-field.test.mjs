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
  assert.equal(mobile.bufferWidth, 244);
  assert.equal(mobile.bufferHeight, 528);
});

test('low quality remains available for subsequent adaptive downgrade', () => {
  const low = getSceneMetrics({ width: 1000, height: 500, quality: 'low', devicePixelRatio: 3 });
  assert.equal(low.pixelRatio, 1);
  assert.equal(low.renderScale, 0.5);
  assert.equal(low.octaves, 2);
  assert.equal(low.splatCount, 4);
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

test('page presets protect contact content and remove the detail moon', () => {
  assert.deepEqual(getPagePreset('contact'), { cloudStrength: 0.45, trailStrength: 0, starBoost: 1, moonStrength: 0 });
  assert.deepEqual(getPagePreset('profile'), { cloudStrength: 1, trailStrength: 1, starBoost: 1, moonStrength: 1 });
  assert.equal(getPagePreset('works').cloudStrength, 0.7);
  assert.equal(getPagePreset('works').trailStrength, 0.7);
  assert.equal(getPagePreset('detail').cloudStrength, 0.6);
  assert.equal(getPagePreset('detail').moonStrength, 0);
  assert.deepEqual(getPagePreset('unknown'), getPagePreset('profile'));
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
  assert.deepEqual(gl.uniforms.get('uPreset'), [0.45, 0, 1, 0]);
  assert.deepEqual(gl.uniforms.get('uResolution'), [600, 450]);
  assert.equal(gl.uniforms.get('uTrailPosition[0]').length, 48);
  assert.equal(canvas.width, 600);
  assert.equal(canvas.height, 450);
  scene.destroy();
  scene.destroy();
  assert.equal(gl.allocated.size, 0);
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
  assert.deepEqual(gl.uniforms.get('uPreset'), [0.6, 0.6, 1, 0]);
  scene.destroy();
});
