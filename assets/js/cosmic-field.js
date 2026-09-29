const NOOP_SCENE = () => ({
  renderStatic() {},
  destroy() {},
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export function getSceneMetrics({
  width = 0,
  height = 0,
  devicePixelRatio = 1,
  reducedMotion = false,
} = {}) {
  const safeWidth = Math.max(0, finite(width));
  const safeHeight = Math.max(0, finite(height));
  const area = safeWidth * safeHeight;
  const isMobile = safeWidth > 0 && safeWidth <= 720;
  const pixelRatio = clamp(finite(devicePixelRatio, 1) || 1, 1, 1.5);

  if (area === 0) {
    return {
      pixelRatio,
      starCount: 0,
      constellationCount: 0,
      animate: false,
      meteors: 0,
    };
  }

  if (reducedMotion) {
    return {
      pixelRatio,
      starCount: clamp(Math.round(area / 32000), 18, 42),
      constellationCount: 1,
      animate: false,
      meteors: 0,
    };
  }

  const starCap = isMobile ? 72 : 110;
  const starFloor = isMobile ? 24 : 44;
  const divisor = isMobile ? 10000 : 15000;

  return {
    pixelRatio,
    starCount: clamp(Math.round(area / divisor), starFloor, starCap),
    constellationCount: isMobile ? 2 : 3,
    animate: true,
    meteors: 1,
  };
}

function makeStar(random) {
  const palette = [
    [188, 232, 255],
    [146, 92, 255],
    [236, 168, 255],
    [255, 244, 194],
  ];

  return {
    x: random(),
    y: random(),
    radius: 0.35 + random() * 1.25,
    depth: 0.25 + random() * 0.75,
    phase: random() * Math.PI * 2,
    speed: 0.00035 + random() * 0.0005,
    color: palette[Math.floor(random() * palette.length) % palette.length],
  };
}

function makeConstellation(random) {
  const pointCount = 3 + Math.floor(random() * 3);
  const originX = 0.08 + random() * 0.78;
  const originY = 0.15 + random() * 0.7;
  const points = [];

  for (let index = 0; index < pointCount; index += 1) {
    points.push({
      x: clamp(originX + (random() - 0.5) * 0.2, 0.04, 0.96),
      y: clamp(originY + (random() - 0.5) * 0.18, 0.06, 0.94),
    });
  }

  points.sort((a, b) => a.x - b.x);
  return {
    points,
    phase: random() * Math.PI * 2,
    hue: random() > 0.48 ? '146, 92, 255' : '92, 178, 255',
  };
}

function drawNebulae(context, width, height, driftX, driftY) {
  const violet = context.createRadialGradient(
    width * 0.88 + driftX * 18,
    height * 0.18 + driftY * 12,
    0,
    width * 0.88,
    height * 0.18,
    Math.max(width, height) * 0.56,
  );
  violet.addColorStop(0, 'rgba(92, 45, 188, 0.105)');
  violet.addColorStop(0.42, 'rgba(56, 37, 120, 0.045)');
  violet.addColorStop(1, 'rgba(5, 5, 9, 0)');
  context.fillStyle = violet;
  context.fillRect(0, 0, width, height);

  const blue = context.createRadialGradient(
    width * 0.05 - driftX * 12,
    height * 0.82 - driftY * 8,
    0,
    width * 0.05,
    height * 0.82,
    Math.max(width, height) * 0.48,
  );
  blue.addColorStop(0, 'rgba(35, 101, 177, 0.075)');
  blue.addColorStop(0.5, 'rgba(22, 55, 104, 0.03)');
  blue.addColorStop(1, 'rgba(5, 5, 9, 0)');
  context.fillStyle = blue;
  context.fillRect(0, 0, width, height);
}

function drawStar(context, star, width, height, time, driftX, driftY, animate) {
  const x = star.x * width + driftX * star.depth * 13;
  const y = star.y * height + driftY * star.depth * 9;
  const twinkle = animate ? 0.52 + Math.sin(time * star.speed + star.phase) * 0.2 : 0.62;
  const [red, green, blue] = star.color;

  context.beginPath();
  context.arc(x, y, star.radius, 0, Math.PI * 2);
  context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${clamp(twinkle, 0.22, 0.8)})`;
  context.shadowColor = `rgba(${red}, ${green}, ${blue}, 0.7)`;
  context.shadowBlur = star.radius > 1 ? 7 : 3;
  context.fill();
  context.shadowBlur = 0;

  if (star.radius > 1.22) {
    context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${twinkle * 0.32})`;
    context.lineWidth = 0.55;
    context.beginPath();
    context.moveTo(x - star.radius * 3.5, y);
    context.lineTo(x + star.radius * 3.5, y);
    context.moveTo(x, y - star.radius * 3.5);
    context.lineTo(x, y + star.radius * 3.5);
    context.stroke();
  }
}

function drawConstellation(context, constellation, width, height, time, driftX, driftY, animate) {
  const pulse = animate ? 0.5 + Math.sin(time * 0.00016 + constellation.phase) * 0.5 : 0.55;
  const alpha = 0.055 + pulse * 0.075;
  const points = constellation.points.map((point) => ({
    x: point.x * width + driftX * 7,
    y: point.y * height + driftY * 5,
  }));

  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.strokeStyle = `rgba(${constellation.hue}, ${alpha})`;
  context.lineWidth = 0.65;
  context.stroke();

  for (const point of points) {
    context.beginPath();
    context.arc(point.x, point.y, 1.05, 0, Math.PI * 2);
    context.fillStyle = `rgba(205, 226, 255, ${alpha * 2.6})`;
    context.fill();
  }
}

export function createCosmicScene(canvas, options = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') return NOOP_SCENE();

  let context;
  try {
    context = canvas.getContext('2d');
  } catch {
    return NOOP_SCENE();
  }
  if (!context) return NOOP_SCENE();

  const windowTarget = options.windowTarget
    ?? (typeof window !== 'undefined' ? window : undefined);
  const documentTarget = options.documentTarget
    ?? (typeof document !== 'undefined' ? document : undefined);
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const requestFrame = options.requestFrame
    ?? windowTarget?.requestAnimationFrame?.bind(windowTarget)
    ?? (() => null);
  const cancelFrame = options.cancelFrame
    ?? windowTarget?.cancelAnimationFrame?.bind(windowTarget)
    ?? (() => {});
  const motionQuery = options.motionQuery;
  let reducedMotion = motionQuery?.matches === true || Boolean(options.reducedMotion);

  let width = 0;
  let height = 0;
  let metrics = getSceneMetrics();
  let stars = [];
  let constellations = [];
  let frameId = null;
  let destroyed = false;
  let visible = documentTarget?.hidden !== true;
  let elapsed = 0;
  let previousTime = 0;
  let meteor = null;
  let nextMeteorAt = 6500 + random() * 7000;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function resize() {
    const rect = typeof canvas.getBoundingClientRect === 'function'
      ? canvas.getBoundingClientRect()
      : null;
    width = Math.max(0, finite(rect?.width, finite(windowTarget?.innerWidth)));
    height = Math.max(0, finite(rect?.height, finite(windowTarget?.innerHeight)));
    metrics = getSceneMetrics({
      width,
      height,
      devicePixelRatio: windowTarget?.devicePixelRatio ?? 1,
      reducedMotion,
    });

    canvas.width = Math.round(width * metrics.pixelRatio);
    canvas.height = Math.round(height * metrics.pixelRatio);
    context.setTransform(metrics.pixelRatio, 0, 0, metrics.pixelRatio, 0, 0);
    stars = Array.from({ length: metrics.starCount }, () => makeStar(random));
    constellations = Array.from(
      { length: metrics.constellationCount },
      () => makeConstellation(random),
    );
  }

  function drawMeteor() {
    if (!meteor) return;
    const progress = clamp((elapsed - meteor.startedAt) / meteor.duration, 0, 1);
    if (progress >= 1) {
      meteor = null;
      nextMeteorAt = elapsed + 7500 + random() * 9000;
      return;
    }

    const eased = 1 - ((1 - progress) ** 3);
    const x = meteor.startX + meteor.length * eased;
    const y = meteor.startY + meteor.length * 0.48 * eased;
    const tailX = x - meteor.tail;
    const tailY = y - meteor.tail * 0.48;
    const gradient = context.createLinearGradient(tailX, tailY, x, y);
    gradient.addColorStop(0, 'rgba(67, 141, 255, 0)');
    gradient.addColorStop(0.72, 'rgba(112, 180, 255, 0.22)');
    gradient.addColorStop(1, 'rgba(225, 245, 255, 0.86)');
    context.beginPath();
    context.moveTo(tailX, tailY);
    context.lineTo(x, y);
    context.strokeStyle = gradient;
    context.lineWidth = 1;
    context.shadowColor = 'rgba(67, 141, 255, 0.7)';
    context.shadowBlur = 8;
    context.stroke();
    context.shadowBlur = 0;
  }

  function render() {
    context.clearRect(0, 0, width, height);
    pointer.x += (pointer.targetX - pointer.x) * 0.035;
    pointer.y += (pointer.targetY - pointer.y) * 0.035;
    drawNebulae(context, width, height, pointer.x, pointer.y);

    for (const constellation of constellations) {
      drawConstellation(
        context,
        constellation,
        width,
        height,
        elapsed,
        pointer.x,
        pointer.y,
        metrics.animate,
      );
    }

    for (const star of stars) {
      drawStar(context, star, width, height, elapsed, pointer.x, pointer.y, metrics.animate);
    }

    if (metrics.meteors > 0 && !meteor && elapsed >= nextMeteorAt) {
      meteor = {
        startX: width * (0.08 + random() * 0.58),
        startY: height * (0.02 + random() * 0.28),
        length: Math.min(width, height) * (0.28 + random() * 0.18),
        tail: Math.min(width, height) * 0.12,
        duration: 950 + random() * 450,
        startedAt: elapsed,
      };
    }
    drawMeteor();
  }

  function tick(time = 0) {
    if (destroyed || !visible || !metrics.animate) return;
    const delta = previousTime === 0 ? 16 : Math.min(48, Math.max(0, time - previousTime));
    previousTime = time;
    elapsed += delta;
    render();
    frameId = requestFrame(tick);
  }

  function renderStatic() {
    elapsed = 0;
    render();
  }

  function onPointerMove(event) {
    if (!metrics.animate || width === 0 || height === 0) return;
    pointer.targetX = clamp((finite(event?.clientX) / width) * 2 - 1, -1, 1);
    pointer.targetY = clamp((finite(event?.clientY) / height) * 2 - 1, -1, 1);
  }

  function onVisibilityChange() {
    visible = documentTarget?.hidden !== true;
    if (!visible && frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
      return;
    }
    if (visible && metrics.animate && frameId === null && !destroyed) {
      previousTime = 0;
      frameId = requestFrame(tick);
    }
  }

  function onMotionPreferenceChange(event) {
    const nextReducedMotion = event?.matches === true;
    if (destroyed || nextReducedMotion === reducedMotion) return;

    if (nextReducedMotion && frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }
    reducedMotion = nextReducedMotion;
    previousTime = 0;
    meteor = null;
    resize();
    renderStatic();

    if (!reducedMotion && visible && frameId === null) {
      frameId = requestFrame(tick);
    }
  }

  function onResize() {
    resize();
    renderStatic();
  }

  resize();
  renderStatic();
  windowTarget?.addEventListener?.('resize', onResize, { passive: true });
  windowTarget?.addEventListener?.('pointermove', onPointerMove, { passive: true });
  documentTarget?.addEventListener?.('visibilitychange', onVisibilityChange);
  if (typeof motionQuery?.addEventListener === 'function') {
    motionQuery.addEventListener('change', onMotionPreferenceChange);
  } else {
    motionQuery?.addListener?.(onMotionPreferenceChange);
  }

  if (metrics.animate && visible) frameId = requestFrame(tick);

  return {
    renderStatic,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frameId !== null) cancelFrame(frameId);
      frameId = null;
      windowTarget?.removeEventListener?.('resize', onResize);
      windowTarget?.removeEventListener?.('pointermove', onPointerMove);
      documentTarget?.removeEventListener?.('visibilitychange', onVisibilityChange);
      if (typeof motionQuery?.removeEventListener === 'function') {
        motionQuery.removeEventListener('change', onMotionPreferenceChange);
      } else {
        motionQuery?.removeListener?.(onMotionPreferenceChange);
      }
    },
  };
}

export function bootCosmicField(
  doc = typeof document !== 'undefined' ? document : undefined,
  win = typeof window !== 'undefined' ? window : undefined,
) {
  if (!doc || !win || typeof doc.getElementById !== 'function' || typeof doc.createElement !== 'function') {
    return null;
  }

  let canvas = doc.getElementById('cosmic-field');
  if (!canvas) {
    canvas = doc.createElement('canvas');
    if (!canvas) return null;
    canvas.id = 'cosmic-field';
    canvas.setAttribute?.('aria-hidden', 'true');
    const parent = doc.body ?? doc.documentElement;
    if (!parent) return null;
    if (typeof parent.prepend === 'function') parent.prepend(canvas);
    else if (typeof parent.insertBefore === 'function') parent.insertBefore(canvas, parent.firstChild ?? null);
    else return null;
  }

  const motionQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const scene = createCosmicScene(canvas, {
    windowTarget: win,
    documentTarget: doc,
    reducedMotion: motionQuery?.matches === true,
    motionQuery,
  });
  canvas.__cosmicScene = scene;
  return scene;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const start = () => bootCosmicField(document, window);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
