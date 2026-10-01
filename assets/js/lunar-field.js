import { VERTEX_SHADER_SOURCE, createFragmentShaderSource } from './lunar-shaders.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const QUALITY = {
  high: { renderScale: 0.75, octaves: 4, splatCount: 12, meteorCount: 5 },
  medium: { renderScale: 0.625, octaves: 3, splatCount: 8, meteorCount: 4 },
  low: { renderScale: 0.5, octaves: 2, splatCount: 4, meteorCount: 3 },
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
export function createPointerTrail({ limit = 12, decayMs = 2000 } = {}) {
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
          positions.set([point.x, point.y, point.strength, 100], index * 4);
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

const activeScenes = new WeakMap();

export function createLunarScene(canvas, options = {}) {
  if (canvas && activeScenes.has(canvas)) return activeScenes.get(canvas);
  const windowTarget = options.windowTarget ?? (typeof window === 'undefined' ? undefined : window);
  const documentTarget = options.documentTarget ?? (typeof document === 'undefined' ? undefined : document);
  const requestFrame = options.requestFrame ?? windowTarget?.requestAnimationFrame?.bind(windowTarget) ?? (() => null);
  const cancelFrame = options.cancelFrame ?? windowTarget?.cancelAnimationFrame?.bind(windowTarget) ?? (() => {});
  const now = options.now ?? (() => globalThis.performance?.now?.() ?? Date.now());
  const fallbackElement = options.fallbackElement ?? documentTarget?.querySelector?.('.lunar-fallback');
  const motionQuery = options.motionQuery ?? windowTarget?.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reducedMotion = options.reducedMotion ?? motionQuery?.matches ?? false;
  function measure(quality) {
    const rect = canvas?.getBoundingClientRect?.();
    return getSceneMetrics({
      width: windowTarget?.innerWidth ?? rect?.width,
      height: windowTarget?.innerHeight ?? rect?.height,
      devicePixelRatio: windowTarget?.devicePixelRatio,
      mobile: options.mobile, quality, reducedMotion,
    });
  }
  let metrics = measure(options.quality);
  const preset = getPagePreset(options.pageMode);
  const trail = createPointerTrail({ limit: metrics.splatCount });
  const started = now();
  let renderer;
  let frameId = null;
  let destroyed = false;
  let fallback = true;
  let reported = false;
  let contextLost = false;
  let generation = 0;
  let lastFrameTime = null;
  const frameTimes = new Float64Array(90);
  let frameCount = 0;
  let frameCursor = 0;
  let frameTotal = 0;
  let lastPointer = null;
  const removers = [];

  function listen(target, type, handler, listenerOptions) {
    target?.addEventListener?.(type, handler, listenerOptions);
    removers.push(() => target?.removeEventListener?.(type, handler, listenerOptions));
  }

  function showFallback(value) {
    fallback = value;
    if (fallbackElement) fallbackElement.hidden = !value;
    if (canvas?.style) canvas.style.visibility = value ? 'hidden' : 'visible';
  }
  function stop() {
    generation++;
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
    lastFrameTime = null;
    resetFrameWindow();
  }
  function resetFrameWindow() {
    frameTimes.fill(0);
    frameCount = 0;
    frameCursor = 0;
    frameTotal = 0;
  }
  function clearInput() {
    trail.clear();
    lastPointer = null;
  }
  function releaseRenderer() {
    renderer?.destroy();
    renderer = null;
  }
  function fail(error) {
    stop();
    releaseRenderer();
    showFallback(true);
    if (error && !reported) {
      reported = true;
      if (options.onError) options.onError(error);
      else globalThis.console?.warn?.('Lunar field unavailable; using static background.', error);
    }
  }
  function render(time = 0) {
    if (destroyed || contextLost || !renderer || !metrics.width || !metrics.height) return;
    try {
      renderer.render({
        width: metrics.width, height: metrics.height, time: reducedMotion ? 0 : time, metrics, preset,
        trail: reducedMotion ? [] : trail.sample(now()).slice(-metrics.splatCount),
      });
      showFallback(false);
    } catch (error) { fail(error); }
  }
  function canAnimate() {
    return !destroyed && !contextLost && !!renderer && !fallback && metrics.animate && documentTarget?.hidden !== true;
  }
  function schedule() {
    if (!canAnimate() || frameId !== null) return;
    if (lastFrameTime === null) lastFrameTime = now();
    const scheduledGeneration = generation;
    frameId = requestFrame(timestamp => tick(timestamp, scheduledGeneration));
  }
  function tick(timestamp, scheduledGeneration) {
    // A cancelled callback may already be queued when a new loop starts.
    if (scheduledGeneration !== generation || !canAnimate()) return;
    frameId = null;
    const time = finite(timestamp, now());
    const duration = Math.max(0, time - lastFrameTime);
    frameTotal += duration - frameTimes[frameCursor];
    frameTimes[frameCursor] = duration;
    frameCursor = (frameCursor + 1) % frameTimes.length;
    frameCount = Math.min(frameCount + 1, frameTimes.length);
    lastFrameTime = time;
    if (frameCount === frameTimes.length && frameTotal / frameCount > 22 && metrics.quality !== 'low') {
      resetFrameWindow();
      lastFrameTime = null;
      metrics = measure(metrics.quality === 'high' ? 'medium' : 'low');
      releaseRenderer();
      initialize();
      return;
    }
    render(Math.max(0, time - started) / 1000);
    schedule();
  }
  function resizeRenderer() {
    if (canvas?.style) {
      canvas.style.width = `${metrics.width}px`;
      canvas.style.height = `${metrics.height}px`;
    }
    renderer?.resize(metrics.bufferWidth, metrics.bufferHeight);
  }
  function initialize() {
    if (destroyed || contextLost || renderer) return;
    showFallback(true);
    try {
      renderer = (options.rendererFactory ?? createWebGLRenderer)(canvas, metrics);
      resizeRenderer();
      if (renderer) {
        render(Math.max(0, now() - started) / 1000);
        schedule();
      }
    } catch (error) { fail(error); }
  }
  function onPointerMove(event) {
    if (!canAnimate()) return;
    const width = finite(windowTarget?.innerWidth, metrics.width);
    const height = finite(windowTarget?.innerHeight, metrics.height);
    if (width <= 0 || height <= 0) return;
    const time = now();
    const x = clamp(finite(event.clientX) / width, 0, 1);
    const y = clamp(finite(event.clientY) / height, 0, 1);
    // Normalize velocity to one 60 Hz frame, limiting fast/coalesced input.
    const elapsed = lastPointer ? Math.max(1, time - lastPointer.time) : 16.67;
    const dx = lastPointer ? clamp((x - lastPointer.x) * 16.67 / elapsed, -1, 1) : 0;
    const dy = lastPointer ? clamp((y - lastPointer.y) * 16.67 / elapsed, -1, 1) : 0;
    trail.push({ x, y, dx, dy, strength: clamp(0.2 + Math.hypot(dx, dy) * 2, 0, 1) }, time);
    lastPointer = { x, y, time };
  }
  function onResize() {
    if (destroyed) return;
    stop();
    metrics = measure(metrics.quality);
    try {
      resizeRenderer();
      render(Math.max(0, now() - started) / 1000);
      schedule();
    } catch (error) { fail(error); }
  }
  function onMotionChange(event) {
    if (destroyed) return;
    reducedMotion = Boolean(event.matches);
    clearInput();
    onResize();
  }
  function onVisibilityChange() {
    if (destroyed) return;
    if (documentTarget?.hidden) {
      stop();
      clearInput();
    } else {
      schedule();
    }
  }
  function onContextLost(event) {
    if (destroyed) return;
    event.preventDefault();
    if (contextLost) return;
    contextLost = true;
    clearInput();
    fail();
  }
  function onContextRestored() {
    if (destroyed || !contextLost) return;
    contextLost = false;
    metrics = measure(metrics.quality);
    initialize();
  }

  listen(windowTarget, 'pointermove', onPointerMove, { passive: true });
  listen(windowTarget, 'resize', onResize);
  listen(documentTarget, 'visibilitychange', onVisibilityChange);
  listen(motionQuery, 'change', onMotionChange);
  listen(canvas, 'webglcontextlost', onContextLost);
  listen(canvas, 'webglcontextrestored', onContextRestored);
  initialize();

  const scene = {
    get fallback() { return fallback; },
    get metrics() { return metrics; },
    renderStatic() { render(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      clearInput();
      for (const remove of removers) remove();
      removers.length = 0;
      releaseRenderer();
      if (canvas) activeScenes.delete(canvas);
      showFallback(true);
    },
  };
  if (canvas) activeScenes.set(canvas, scene);
  return scene;
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
