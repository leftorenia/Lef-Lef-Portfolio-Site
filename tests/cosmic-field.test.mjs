import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootCosmicField,
  createCosmicScene,
  getSceneMetrics,
} from '../assets/js/cosmic-field.js';

function noopContext() {
  const gradient = { addColorStop() {} };
  const methods = new Set([
    'arc',
    'beginPath',
    'clearRect',
    'closePath',
    'fill',
    'fillRect',
    'lineTo',
    'moveTo',
    'restore',
    'rotate',
    'save',
    'scale',
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
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    ...overrides,
  };
}

function fakeDocument() {
  return {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  };
}

function fakeCanvas(context = noopContext()) {
  return {
    width: 0,
    height: 0,
    style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 640, height: 360 }),
    setAttribute() {},
  };
}

test('cosmic field caps density and pixel ratio by viewport class', () => {
  const desktop = getSceneMetrics({
    width: 1440,
    height: 900,
    devicePixelRatio: 3,
    reducedMotion: false,
  });
  const mobile = getSceneMetrics({
    width: 390,
    height: 844,
    devicePixelRatio: 2,
    reducedMotion: false,
  });

  assert.equal(desktop.pixelRatio, 1.5);
  assert.ok(desktop.starCount <= 110);
  assert.ok(mobile.starCount <= 72);
  assert.ok(mobile.starCount < desktop.starCount);
  assert.equal(desktop.animate, true);
  assert.equal(mobile.animate, true);
});

test('cosmic field reduces visual density and disables meteors for reduced motion', () => {
  const reduced = getSceneMetrics({
    width: 1440,
    height: 900,
    devicePixelRatio: 2,
    reducedMotion: true,
  });

  assert.equal(reduced.animate, false);
  assert.equal(reduced.meteors, 0);
  assert.ok(reduced.starCount <= 42);
  assert.ok(reduced.constellationCount <= 1);
});

test('cosmic field returns finite non-negative metrics for a zero viewport', () => {
  const metrics = getSceneMetrics({
    width: 0,
    height: 0,
    devicePixelRatio: 0,
    reducedMotion: false,
  });

  for (const value of [metrics.pixelRatio, metrics.starCount, metrics.constellationCount, metrics.meteors]) {
    assert.ok(Number.isFinite(value));
    assert.ok(value >= 0);
  }
});

test('cosmic field is a safe no-op when Canvas 2D is unavailable', () => {
  const scene = createCosmicScene({ getContext: () => null });
  assert.doesNotThrow(() => scene.renderStatic());
  assert.doesNotThrow(() => scene.destroy());
});

test('cosmic field renders once without scheduling frames in reduced motion', () => {
  let requestedFrames = 0;
  const scene = createCosmicScene(fakeCanvas(), {
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
  assert.doesNotThrow(() => scene.destroy());
});

test('cosmic field boot is safe without a usable document', () => {
  assert.equal(bootCosmicField(undefined, undefined), null);
  assert.equal(
    bootCosmicField({ getElementById: () => null, createElement: () => null }, fakeWindow()),
    null,
  );
});
