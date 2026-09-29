const NOOP_PREVIEW = () => ({
  renderStatic() {},
  destroy() {},
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export function getPreviewMetrics({
  width = 0,
  height = 0,
  devicePixelRatio = 1,
  reducedMotion = false,
} = {}) {
  const safeWidth = Math.max(0, finite(width));
  const safeHeight = Math.max(0, finite(height));
  const area = safeWidth * safeHeight;
  const pixelRatio = clamp(finite(devicePixelRatio, 1) || 1, 1, 1.5);

  if (area === 0) {
    return { pixelRatio, particleCount: 0, animate: false };
  }

  if (reducedMotion) {
    return {
      pixelRatio,
      particleCount: clamp(Math.round(area / 22000), 12, 32),
      animate: false,
    };
  }

  return {
    pixelRatio,
    particleCount: clamp(Math.round(area / 9000), 24, 64),
    animate: true,
  };
}

function makeParticle(random) {
  const colors = [
    [190, 214, 246],
    [109, 145, 201],
    [215, 196, 231],
    [238, 244, 255],
  ];

  return {
    x: random(),
    y: random(),
    radius: 0.45 + random() * 1.45,
    phase: random() * Math.PI * 2,
    speed: 0.0005 + random() * 0.0008,
    drift: (random() - 0.5) * 0.000012,
    color: colors[Math.floor(random() * colors.length) % colors.length],
  };
}

function drawBackdrop(context, width, height, time, animate) {
  const pulse = animate ? 0.86 + Math.sin(time * 0.00035) * 0.08 : 0.9;
  const cloud = context.createRadialGradient(
    width * 0.41,
    height * 0.51,
    0,
    width * 0.41,
    height * 0.51,
    Math.max(width, height) * 0.48,
  );
  cloud.addColorStop(0, `rgba(215, 196, 231, ${0.13 * pulse})`);
  cloud.addColorStop(0.28, `rgba(40, 77, 134, ${0.075 * pulse})`);
  cloud.addColorStop(1, 'rgba(3, 8, 21, 0)');
  context.fillStyle = cloud;
  context.fillRect(0, 0, width, height);

  const blue = context.createRadialGradient(
    width * 0.82,
    height * 0.26,
    0,
    width * 0.82,
    height * 0.26,
    Math.max(width, height) * 0.34,
  );
  blue.addColorStop(0, 'rgba(109, 145, 201, 0.08)');
  blue.addColorStop(1, 'rgba(3, 8, 21, 0)');
  context.fillStyle = blue;
  context.fillRect(0, 0, width, height);
}

function drawParticles(context, particles, width, height, time, animate) {
  for (const particle of particles) {
    const drift = animate ? time * particle.drift * width : 0;
    const x = ((particle.x * width + drift) % width + width) % width;
    const y = particle.y * height;
    const alpha = animate
      ? 0.38 + Math.sin(time * particle.speed + particle.phase) * 0.2
      : 0.5;
    const [red, green, blue] = particle.color;

    context.beginPath();
    context.arc(x, y, particle.radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0.14, 0.72)})`;
    context.shadowColor = `rgba(${red}, ${green}, ${blue}, 0.7)`;
    context.shadowBlur = particle.radius > 1.3 ? 7 : 3;
    context.fill();
    context.shadowBlur = 0;
  }
}

function drawOrbitalFocus(context, width, height, time, animate) {
  const centerX = width * 0.41;
  const centerY = height * 0.53;
  const radius = Math.min(width, height) * 0.105;
  const pulse = animate ? 1 + Math.sin(time * 0.0011) * 0.035 : 1;

  context.save();
  context.translate(centerX, centerY);
  context.rotate(-0.28);
  context.beginPath();
  context.ellipse(0, 0, radius * 2.4 * pulse, radius * 0.74, 0, 0, Math.PI * 2);
  context.strokeStyle = 'rgba(190, 214, 246, 0.34)';
  context.lineWidth = 0.75;
  context.shadowColor = 'rgba(109, 145, 201, 0.42)';
  context.shadowBlur = 12;
  context.stroke();

  context.rotate(1.06);
  context.beginPath();
  context.ellipse(0, 0, radius * 1.7, radius * 0.6, 0, 0, Math.PI * 2);
  context.strokeStyle = 'rgba(215, 196, 231, 0.28)';
  context.stroke();
  context.restore();

  const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 2.2);
  glow.addColorStop(0, 'rgba(238, 244, 255, 0.88)');
  glow.addColorStop(0.055, 'rgba(190, 214, 246, 0.48)');
  glow.addColorStop(0.2, 'rgba(109, 145, 201, 0.2)');
  glow.addColorStop(1, 'rgba(40, 77, 134, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(centerX, centerY, radius * 2.2, 0, Math.PI * 2);
  context.fill();
}

function drawConstellation(context, width, height, time, animate) {
  const points = [
    [0.61, 0.69],
    [0.67, 0.61],
    [0.72, 0.67],
    [0.78, 0.56],
    [0.84, 0.62],
    [0.9, 0.49],
  ];
  const pulse = animate ? 0.56 + Math.sin(time * 0.00045) * 0.2 : 0.58;

  context.beginPath();
  points.forEach(([x, y], index) => {
    const pointX = x * width;
    const pointY = y * height;
    if (index === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  });
  context.strokeStyle = `rgba(109, 145, 201, ${0.15 * pulse})`;
  context.lineWidth = 0.8;
  context.stroke();

  for (const [x, y] of points) {
    context.beginPath();
    context.arc(x * width, y * height, 1.45, 0, Math.PI * 2);
    context.fillStyle = `rgba(190, 214, 246, ${0.52 * pulse})`;
    context.shadowColor = 'rgba(215, 196, 231, 0.65)';
    context.shadowBlur = 6;
    context.fill();
  }
  context.shadowBlur = 0;
}

export function createWorkPreview(canvas, options = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') return NOOP_PREVIEW();

  let context;
  try {
    context = canvas.getContext('2d');
  } catch {
    return NOOP_PREVIEW();
  }
  if (!context) return NOOP_PREVIEW();

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
  let metrics = getPreviewMetrics();
  let particles = [];
  let elapsed = 0;
  let previousTime = 0;
  let streak = null;
  let nextStreakAt = 4200 + random() * 4500;
  let frameId = null;
  let destroyed = false;
  let visible = documentTarget?.hidden !== true;

  function resize() {
    const rect = typeof canvas.getBoundingClientRect === 'function'
      ? canvas.getBoundingClientRect()
      : null;
    width = Math.max(0, finite(rect?.width));
    height = Math.max(0, finite(rect?.height));
    metrics = getPreviewMetrics({
      width,
      height,
      devicePixelRatio: windowTarget?.devicePixelRatio ?? 1,
      reducedMotion,
    });
    canvas.width = Math.round(width * metrics.pixelRatio);
    canvas.height = Math.round(height * metrics.pixelRatio);
    context.setTransform(metrics.pixelRatio, 0, 0, metrics.pixelRatio, 0, 0);
    particles = Array.from({ length: metrics.particleCount }, () => makeParticle(random));
  }

  function drawStreak() {
    if (!streak) return;
    const progress = clamp((elapsed - streak.startedAt) / streak.duration, 0, 1);
    if (progress >= 1) {
      streak = null;
      nextStreakAt = elapsed + 5200 + random() * 6500;
      return;
    }

    const headX = streak.startX + streak.distance * progress;
    const headY = streak.startY - streak.distance * 0.38 * progress;
    const tailX = headX - streak.tail;
    const tailY = headY + streak.tail * 0.38;
    const gradient = context.createLinearGradient(tailX, tailY, headX, headY);
    gradient.addColorStop(0, 'rgba(40, 77, 134, 0)');
    gradient.addColorStop(0.75, 'rgba(109, 145, 201, 0.35)');
    gradient.addColorStop(1, 'rgba(238, 244, 255, 0.92)');
    context.beginPath();
    context.moveTo(tailX, tailY);
    context.lineTo(headX, headY);
    context.strokeStyle = gradient;
    context.lineWidth = 1.15;
    context.shadowColor = 'rgba(190, 214, 246, 0.7)';
    context.shadowBlur = 9;
    context.stroke();
    context.shadowBlur = 0;
  }

  function render() {
    context.clearRect(0, 0, width, height);
    drawBackdrop(context, width, height, elapsed, metrics.animate);
    drawParticles(context, particles, width, height, elapsed, metrics.animate);
    drawOrbitalFocus(context, width, height, elapsed, metrics.animate);
    drawConstellation(context, width, height, elapsed, metrics.animate);

    if (metrics.animate && !streak && elapsed >= nextStreakAt) {
      streak = {
        startX: width * (0.09 + random() * 0.18),
        startY: height * (0.76 + random() * 0.14),
        distance: Math.min(width, height) * (0.34 + random() * 0.18),
        tail: Math.min(width, height) * 0.15,
        duration: 900 + random() * 350,
        startedAt: elapsed,
      };
    }
    drawStreak();
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

  function onResize() {
    resize();
    renderStatic();
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
    streak = null;
    resize();
    renderStatic();

    if (!reducedMotion && visible && frameId === null) {
      frameId = requestFrame(tick);
    }
  }

  resize();
  renderStatic();
  const fallback = canvas.parentElement?.querySelector?.('.work-preview-fallback')
    ?? canvas.closest?.('.work-visual, .work-detail-visual')?.querySelector?.('.work-preview-fallback');
  if (fallback?.style) fallback.style.opacity = '0';
  windowTarget?.addEventListener?.('resize', onResize, { passive: true });
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
      documentTarget?.removeEventListener?.('visibilitychange', onVisibilityChange);
      if (typeof motionQuery?.removeEventListener === 'function') {
        motionQuery.removeEventListener('change', onMotionPreferenceChange);
      } else {
        motionQuery?.removeListener?.(onMotionPreferenceChange);
      }
    },
  };
}

export function bootWorkPreviews(
  root = typeof document !== 'undefined' ? document : undefined,
  win = typeof window !== 'undefined' ? window : undefined,
) {
  if (!root || !win || typeof root.querySelectorAll !== 'function') return 0;

  const canvases = [...root.querySelectorAll('canvas[data-work-preview]')];
  const motionQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reducedMotion = motionQuery?.matches === true;
  let started = 0;

  for (const canvas of canvases) {
    if (canvas.__workPreview) continue;
    canvas.__workPreview = createWorkPreview(canvas, {
      windowTarget: win,
      documentTarget: root,
      reducedMotion,
      motionQuery,
    });
    started += 1;
  }

  return started;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const start = () => bootWorkPreviews(document, window);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
