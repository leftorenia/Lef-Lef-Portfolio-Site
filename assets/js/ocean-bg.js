(function () {
  'use strict';

  var canvas = document.createElement('canvas');
  canvas.id = 'ocean-bg';
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.zIndex = '-1';
  canvas.style.pointerEvents = 'none';
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var ripples = [];
  var lastSpawn = 0;
  var SPAWN_INTERVAL = 700;
  var MAX_RIPPLES = 4;
  var t = 0;

  var particles = [];
  var bubbles = [];
  var fish = [];
  var nextFishAt = 1500 + Math.random() * 3000;
  var TARGET_FISH = 2 + Math.floor(Math.random() * 2);

  function initParticles() {
    particles = [];
    var count = Math.floor((canvas.width * canvas.height) / 8000);
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 0.6 + Math.random() * 1.5,
        speed: 0.08 + Math.random() * 0.18,
        drift: (Math.random() - 0.5) * 0.06,
        alpha: 0.10 + Math.random() * 0.32,
        hueMix: Math.random()
      });
    }
  }

  function initBubbles() {
    bubbles = [];
    var count = Math.floor((canvas.width * canvas.height) / 14000);
    for (var i = 0; i < count; i++) bubbles.push(makeBubble(true));
  }

  function makeBubble(randomY) {
    return {
      x: Math.random() * canvas.width,
      y: randomY ? Math.random() * canvas.height : canvas.height + 10,
      r: 1.5 + Math.random() * 3.2,
      speed: 0.18 + Math.random() * 0.32,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.02 + Math.random() * 0.02,
      wobbleAmp: 4 + Math.random() * 8,
      alpha: 0.18 + Math.random() * 0.3
    };
  }

  function spawnFish() {
    var fromLeft = Math.random() < 0.5;
    fish.push({
      x: fromLeft ? -30 : canvas.width + 30,
      y: canvas.height * (0.2 + Math.random() * 0.6),
      dir: fromLeft ? 1 : -1,
      baseSpeed: 0.75 + Math.random() * 0.65,
      speedPhase: Math.random() * Math.PI * 2,
      speedPhaseSpeed: 0.0015 + Math.random() * 0.0015,
      size: 9 + Math.random() * 5,
      bob: Math.random() * Math.PI * 2,
      tailPhase: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.5 ? 'rgba(125,211,252,' : 'rgba(167,139,250,'
    });
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles();
    initBubbles();
  }
  resize();
  window.addEventListener('resize', resize);

  function spawnRipple(x, y) {
    var maxR = Math.hypot(canvas.width, canvas.height) * 0.65;
    ripples.push({ x: x, y: y, r: 4, maxR: maxR, alpha: 0.62 });
    if (ripples.length > MAX_RIPPLES) ripples.shift();
  }

  window.addEventListener('mousemove', function (e) {
    var now = performance.now();
    if (now - lastSpawn < SPAWN_INTERVAL) return;
    lastSpawn = now;
    spawnRipple(e.clientX, e.clientY);
  });

  function drawAurora() {
    var w = canvas.width, h = canvas.height;
    var shift = Math.sin(t * 0.0006) * 0.12;
    var g = ctx.createRadialGradient(
      w * (0.32 + shift), h * 0.15, 0,
      w * (0.32 + shift), h * 0.15, Math.max(w, h) * 0.8
    );
    var pulse = 0.16 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.0009));
    g.addColorStop(0, 'rgba(124,58,237,' + pulse + ')');
    g.addColorStop(0.5, 'rgba(103,232,249,' + (pulse * 0.65) + ')');
    g.addColorStop(1, 'rgba(10,14,31,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.y -= p.speed;
      p.x += p.drift;
      if (p.y < -4) { p.y = canvas.height + 4; p.x = Math.random() * canvas.width; }
      if (p.x < -4) p.x = canvas.width + 4;
      if (p.x > canvas.width + 4) p.x = -4;

      var twinkle = 0.7 + 0.3 * Math.sin(t * 0.004 + i);
      var color = p.hueMix > 0.5
        ? 'rgba(167,139,250,' + (p.alpha * twinkle) + ')'
        : 'rgba(125,211,252,' + (p.alpha * twinkle) + ')';
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBubbles() {
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      b.y -= b.speed;
      b.wobble += b.wobbleSpeed;
      var bx = b.x + Math.sin(b.wobble) * b.wobbleAmp;
      if (b.y < -10) { bubbles[i] = makeBubble(false); continue; }
      ctx.save();
      ctx.shadowColor = 'rgba(180,225,255,0.9)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(bx, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(180,225,255,' + b.alpha + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bx - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + (b.alpha * 0.9) + ')';
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRipples() {
    for (var i = ripples.length - 1; i >= 0; i--) {
      var rp = ripples[i];
      var growth = 1 - (rp.r / rp.maxR);
      rp.r += 1.2 + growth * 2.2;
      rp.alpha = 0.62 * (1 - rp.r / rp.maxR);
      if (rp.r >= rp.maxR || rp.alpha <= 0.01) { ripples.splice(i, 1); continue; }
      ctx.save();
      ctx.shadowColor = 'rgba(125,211,252,1)';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(125,211,252,' + rp.alpha + ')';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.shadowColor = 'rgba(167,139,250,1)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r * 0.7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(167,139,250,' + (rp.alpha * 0.75) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFish(dt) {
    nextFishAt -= dt;
    if (nextFishAt <= 0 && fish.length < TARGET_FISH) {
      spawnFish();
      nextFishAt = 4000 + Math.random() * 6000;
    }
    for (var i = fish.length - 1; i >= 0; i--) {
      var f = fish[i];
      f.speedPhase += f.speedPhaseSpeed * dt;
      var speedMul = 0.7 + 0.6 * (0.5 + 0.5 * Math.sin(f.speedPhase));
      var curSpeed = f.baseSpeed * speedMul;
      f.x += f.dir * curSpeed * dt * 0.06;
      f.bob += 0.02;
      f.tailPhase += 0.06 + curSpeed * 0.05;
      var fy = f.y + Math.sin(f.bob) * 4;

      if ((f.dir > 0 && f.x > canvas.width + 30) || (f.dir < 0 && f.x < -30)) {
        fish.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(f.x, fy);
      ctx.scale(f.dir, 1);
      ctx.shadowColor = f.hue + '0.9)';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(f.size, 0);
      ctx.quadraticCurveTo(f.size * 0.2, -f.size * 0.45, -f.size * 0.9, 0);
      ctx.quadraticCurveTo(f.size * 0.2, f.size * 0.45, f.size, 0);
      ctx.strokeStyle = f.hue + '0.85)';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      var tailWag = Math.sin(f.tailPhase) * f.size * 0.06;
      ctx.beginPath();
      ctx.moveTo(-f.size * 0.85, 0);
      ctx.lineTo(-f.size * 1.5, -f.size * 0.4 + tailWag);
      ctx.lineTo(-f.size * 1.5, f.size * 0.4 + tailWag);
      ctx.closePath();
      ctx.strokeStyle = f.hue + '0.7)';
      ctx.stroke();
      ctx.restore();
    }
  }

  var lastT = performance.now();
  function tick() {
    var now = performance.now();
    var dt = now - lastT;
    lastT = now;
    t += 16;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawAurora();
    drawParticles();
    drawBubbles();
    drawFish(dt);
    drawRipples();
    requestAnimationFrame(tick);
  }
  tick();
})();
