import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootWorkPreviews,
  createWorkPreview,
  getPreviewMetrics,
} from '../assets/js/work-preview.js';

function noopContext() {
  const gradient = { addColorStop() {} };
  const methods = new Set([
    'arc',
    'beginPath',
    'clearRect',
    'ellipse',
    'fill',
    'fillRect',
    'lineTo',
    'moveTo',
    'restore',
    'rotate',
    'save',
    'setTransform',
    'stroke',
    'translate',
  ]);

  return new Proxy({}, {
    get(_target, property) {
      if (property === 'createLinearGradient' || property === 'createRadialGradient') {
        return () => gradient;
      }
      if (methods.has(property)) return () => {};
      return 0;
    },
    set() {
      return true;
    },
  });
}

function fakeWindow(overrides = {}) {
  return {
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false }),
    ...overrides,
  };
}

function fakeDocument(overrides = {}) {
  return {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
    ...overrides,
  };
}

function fakeCanvas(context = noopContext()) {
  return {
    width: 0,
    height: 0,
    style: {},
    dataset: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 900, height: 520 }),
    closest: () => null,
  };
}

function interactivePreviewFixture({ reducedMotion = false } = {}) {
  const listeners = new Map();
  const properties = new Map();
  const visual = {
    style: {
      setProperty: (name, value) => properties.set(name, value),
      removeProperty: name => properties.delete(name),
    },
    getBoundingClientRect: () => ({ left: 100, top: 200, width: 400, height: 300 }),
    addEventListener(type, handler, options) { listeners.set(type, { handler, options }); },
    removeEventListener(type, handler) {
      if (listeners.get(type)?.handler === handler) listeners.delete(type);
    },
  };
  const link = { querySelector: selector => selector === '.work-visual' ? visual : null };
  const canvas = fakeCanvas();
  canvas.closest = selector => selector === '.work-card-link' ? link : null;
  let motionHandler;
  const preview = createWorkPreview(canvas, {
    windowTarget: fakeWindow(), documentTarget: fakeDocument(), reducedMotion,
    motionQuery: { addEventListener(_type, handler) { motionHandler = handler; }, removeEventListener() {} },
    random: () => 0.5,
  });
  const emit = (type, values = {}) => listeners.get(type)?.handler({
    pointerType: 'mouse', clientX: 200, clientY: 275, ...values,
    preventDefault() { assert.fail('preview input must preserve native scrolling and links'); },
  });
  return { preview, listeners, properties, emit, changeMotion: matches => motionHandler({ matches }) };
}

test('linked preview reveals moonlight at the pointer location using passive input', () => {
  const f = interactivePreviewFixture();
  f.emit('pointermove');
  assert.equal(f.properties.get('--work-pointer-x'), '25%');
  assert.equal(f.properties.get('--work-pointer-y'), '25%');
  assert.equal(f.properties.get('--work-pointer-active'), '1');
  f.emit('pointermove', { clientX: 400, clientY: 425 });
  assert.equal(f.properties.get('--work-pointer-x'), '75%');
  assert.equal(f.properties.get('--work-pointer-y'), '75%');
  for (const { options } of f.listeners.values()) assert.equal(options.passive, true);
  f.emit('pointerleave');
  assert.equal(f.properties.size, 0);
  f.preview.destroy();
});

test('touch reveal preserves scrolling and clears on release or cancellation', () => {
  const f = interactivePreviewFixture();
  for (const event of ['pointerup', 'pointercancel']) {
    f.emit('pointermove', { pointerType: 'touch', clientX: 900, clientY: -10 });
    assert.equal(f.properties.get('--work-pointer-x'), '100%');
    assert.equal(f.properties.get('--work-pointer-y'), '0%');
    assert.equal(f.properties.get('--work-pointer-active'), '1');
    f.emit(event, { pointerType: 'touch' });
    assert.equal(f.properties.size, 0);
  }
  f.preview.destroy();
});

test('reduced motion disables local tracking live and destroy removes listeners and highlight', () => {
  const f = interactivePreviewFixture({ reducedMotion: true });
  f.emit('pointermove');
  assert.equal(f.properties.size, 0);
  f.changeMotion(false);
  f.emit('pointermove');
  assert.equal(f.properties.get('--work-pointer-active'), '1');
  f.changeMotion(true);
  assert.equal(f.properties.size, 0);
  f.changeMotion(false);
  f.emit('pointermove');
  const queued = f.listeners.get('pointermove').handler;
  f.preview.destroy();
  f.preview.destroy();
  assert.equal(f.listeners.size, 0);
  assert.equal(f.properties.size, 0);
  queued({ pointerType: 'mouse', clientX: 200, clientY: 275 });
  assert.equal(f.properties.size, 0, 'queued input after destruction stays inert');
});

test('work preview caps pixel ratio and particle density', () => {
  const metrics = getPreviewMetrics({
    width: 900,
    height: 520,
    devicePixelRatio: 4,
    reducedMotion: false,
  });

  assert.equal(metrics.pixelRatio, 1.5);
  assert.ok(metrics.particleCount > 0);
  assert.ok(metrics.particleCount <= 64);
  assert.equal(metrics.animate, true);
});

test('work preview disables animation and lowers density for reduced motion', () => {
  const normal = getPreviewMetrics({
    width: 900,
    height: 520,
    devicePixelRatio: 1,
    reducedMotion: false,
  });
  const reduced = getPreviewMetrics({
    width: 900,
    height: 520,
    devicePixelRatio: 1,
    reducedMotion: true,
  });

  assert.equal(reduced.animate, false);
  assert.ok(reduced.particleCount < normal.particleCount);
  assert.ok(reduced.particleCount <= 32);
});

test('work preview returns finite non-negative metrics for a zero viewport', () => {
  const metrics = getPreviewMetrics({
    width: 0,
    height: 0,
    devicePixelRatio: 0,
    reducedMotion: false,
  });

  for (const value of [metrics.pixelRatio, metrics.particleCount]) {
    assert.ok(Number.isFinite(value));
    assert.ok(value >= 0);
  }
});

test('work preview is a safe no-op without Canvas 2D', () => {
  const preview = createWorkPreview({ getContext: () => null });
  assert.doesNotThrow(() => preview.renderStatic());
  assert.doesNotThrow(() => preview.destroy());
});

test('work preview renders once without scheduling frames in reduced motion', () => {
  let requestedFrames = 0;
  const preview = createWorkPreview(fakeCanvas(), {
    windowTarget: fakeWindow(),
    documentTarget: fakeDocument(),
    reducedMotion: true,
    random: () => 0.5,
    requestFrame: () => {
      requestedFrames += 1;
      return requestedFrames;
    },
    cancelFrame() {},
  });

  assert.equal(requestedFrames, 0);
  assert.doesNotThrow(() => preview.destroy());
});

test('work preview hides the fallback in any initialized preview container', () => {
  const fallback = { style: { opacity: '0.9' } };
  const canvas = fakeCanvas();
  canvas.parentElement = {
    querySelector(selector) {
      assert.equal(selector, '.work-preview-fallback');
      return fallback;
    },
  };

  const preview = createWorkPreview(canvas, {
    windowTarget: fakeWindow(),
    documentTarget: fakeDocument(),
    reducedMotion: true,
    random: () => 0.5,
  });

  assert.equal(fallback.style.opacity, '0');
  preview.destroy();
});

test('work preview keeps CSS sizing responsive across live viewport changes', () => {
  let resizeHandler;
  const layout = { width: 900, height: 520 };
  const canvas = fakeCanvas();
  canvas.getBoundingClientRect = () => ({
    width: Number.parseFloat(canvas.style.width) || layout.width,
    height: Number.parseFloat(canvas.style.height) || layout.height,
  });
  const preview = createWorkPreview(canvas, {
    windowTarget: fakeWindow({
      addEventListener(type, handler) {
        if (type === 'resize') resizeHandler = handler;
      },
    }),
    documentTarget: fakeDocument(),
    reducedMotion: true,
    random: () => 0.5,
  });

  assert.equal(canvas.width, 900);
  layout.width = 360;
  layout.height = 240;
  resizeHandler();

  assert.equal(canvas.width, 360);
  assert.equal(canvas.height, 240);
  assert.equal(canvas.style.width, undefined);
  assert.equal(canvas.style.height, undefined);
  preview.destroy();
});

test('work preview follows live reduced-motion preference changes', () => {
  let motionHandler;
  let removedHandler;
  let requestedFrames = 0;
  let cancelledFrames = 0;
  const motionQuery = {
    matches: false,
    addEventListener(type, handler) {
      if (type === 'change') motionHandler = handler;
    },
    removeEventListener(type, handler) {
      if (type === 'change') removedHandler = handler;
    },
  };
  const canvas = fakeCanvas();
  const root = fakeDocument({ querySelectorAll: () => [canvas] });
  const win = fakeWindow({
    matchMedia: () => motionQuery,
    requestAnimationFrame() {
      requestedFrames += 1;
      return requestedFrames;
    },
    cancelAnimationFrame() {
      cancelledFrames += 1;
    },
  });

  assert.equal(bootWorkPreviews(root, win), 1);
  assert.equal(requestedFrames, 1);
  assert.equal(typeof motionHandler, 'function');
  motionQuery.matches = true;
  motionHandler({ matches: true });
  assert.equal(cancelledFrames, 1);

  motionQuery.matches = false;
  motionHandler({ matches: false });
  assert.equal(requestedFrames, 2);
  canvas.__workPreview.destroy();
  assert.equal(removedHandler, motionHandler);
});

test('work preview pauses and resumes animation with document visibility', () => {
  let visibilityHandler;
  let requestedFrames = 0;
  let cancelledFrames = 0;
  const doc = fakeDocument({
    addEventListener(type, handler) {
      if (type === 'visibilitychange') visibilityHandler = handler;
    },
  });

  const preview = createWorkPreview(fakeCanvas(), {
    windowTarget: fakeWindow(),
    documentTarget: doc,
    reducedMotion: false,
    random: () => 0.5,
    requestFrame: () => {
      requestedFrames += 1;
      return requestedFrames;
    },
    cancelFrame() {
      cancelledFrames += 1;
    },
  });

  assert.equal(requestedFrames, 1);
  doc.hidden = true;
  visibilityHandler();
  assert.equal(cancelledFrames, 1);
  doc.hidden = false;
  visibilityHandler();
  assert.equal(requestedFrames, 2);
  preview.destroy();
});

test('work preview boot is a no-op when no preview elements exist', () => {
  assert.equal(bootWorkPreviews(undefined, undefined), 0);
  assert.equal(bootWorkPreviews({ querySelectorAll: () => [] }, fakeWindow()), 0);
});

test('work preview draws the moonlit palette in its static frame', () => {
  const colors = [];
  const base = noopContext();
  const context = new Proxy(base, {
    get(target, property) {
      if (property === 'createRadialGradient' || property === 'createLinearGradient') {
        return () => ({ addColorStop(_position, color) { colors.push(color); } });
      }
      return target[property];
    },
    set(_target, property, value) {
      if (['fillStyle', 'strokeStyle', 'shadowColor'].includes(property) && typeof value === 'string') {
        colors.push(value);
      }
      return true;
    },
  });
  const preview = createWorkPreview(fakeCanvas(context), {
    windowTarget: fakeWindow(),
    documentTarget: fakeDocument(),
    reducedMotion: true,
    random: () => 0.5,
  });
  try {
    for (const rgb of ['40, 77, 134', '109, 145, 201', '190, 214, 246', '215, 196, 231']) {
      assert.ok(colors.some(color => color.startsWith(`rgba(${rgb},`)), `missing rendered lunar color ${rgb}`);
    }
    assert.ok(!colors.some(color => /rgba\((?:146, 92, 255|162, 118, 255|104, 66, 213),/.test(color)),
      'the static frame must not retain the previous neon violet clouds');
  } finally {
    preview.destroy();
  }
});
