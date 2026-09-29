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
