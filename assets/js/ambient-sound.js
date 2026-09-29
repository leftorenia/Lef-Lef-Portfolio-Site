export const AMBIENT_STORAGE_KEY = 'lef-lef-portfolio:ambient-enabled';

const FADE_SECONDS = 1;
const MASTER_LEVEL = 0.045;

export function readAmbientPreference(storage) {
  try { return storage?.getItem(AMBIENT_STORAGE_KEY) === 'true'; }
  catch { return false; }
}

// These defaults only discover capabilities. Context creation stays inside the gesture.
function contextFactory(target = globalThis) {
  const AudioContext = target.AudioContext ?? target.webkitAudioContext;
  return AudioContext ? () => new AudioContext() : null;
}

function quietCall(operation) {
  try { Promise.resolve(operation()).catch(() => {}); }
  catch { /* A closed/interrupted context must not break the rest of the page. */ }
}

export function createAmbientSound({
  audioContextFactory = contextFactory(), storage,
  setTimeout: schedule = globalThis.setTimeout.bind(globalThis),
  clearTimeout: cancel = globalThis.clearTimeout.bind(globalThis),
  random = Math.random, now = (context) => context.currentTime,
  onStateChange = () => {},
} = {}) {
  let desired = readAmbientPreference(storage);
  let state = audioContextFactory ? (desired ? 'needs-gesture' : 'off') : 'unavailable';
  let context = null;
  let master = null;
  let destroyed = false;
  let hidden = false;
  let generation = 0;
  let pending = null;
  let bellTimer = null;
  let fadeTimer = null;
  let envelope = { from: 0, to: 0, start: 0, end: 0 };
  const nodes = new Set();
  const sources = new Set();
  const bells = new Map();

  function update(next) { state = next; onStateChange(state); }
  function persist(value) {
    desired = value;
    try { storage?.setItem(AMBIENT_STORAGE_KEY, String(value)); }
    catch { /* The current page still works when storage is blocked. */ }
  }
  function own(node, source = false) {
    nodes.add(node);
    if (source) sources.add(node);
    return node;
  }
  function stopBells() {
    if (bellTimer !== null) cancel(bellTimer);
    bellTimer = null;
    for (const [oscillator, gain] of bells) {
      oscillator.onended = null;
      quietCall(() => oscillator.stop());
      oscillator.disconnect(); gain.disconnect();
      sources.delete(oscillator); nodes.delete(oscillator); nodes.delete(gain);
    }
    bells.clear();
  }
  function cancelFade() {
    if (fadeTimer !== null) cancel(fadeTimer);
    fadeTimer = null;
  }
  function fade(to, duration = FADE_SECONDS) {
    if (!master) return;
    const time = now(context);
    const progress = envelope.end <= envelope.start ? 1
      : Math.min(1, Math.max(0, (time - envelope.start) / (envelope.end - envelope.start)));
    const current = envelope.from + (envelope.to - envelope.from) * progress;
    // Explicit interpolation also works on browsers without cancelAndHoldAtTime.
    master.gain.cancelScheduledValues(time);
    master.gain.setValueAtTime(current, time);
    master.gain.linearRampToValueAtTime(to, time + duration);
    envelope = { from: current, to, start: time, end: time + duration };
  }
  function pause(next) {
    generation++;
    update(next);
    cancelFade();
    if (!context) return;
    fade(0);
    const token = generation;
    fadeTimer = schedule(() => {
      fadeTimer = null;
      if (destroyed || token !== generation) return;
      stopBells();
      quietCall(() => context.suspend());
    }, FADE_SECONDS * 1000);
  }
  function onContextState() {
    if (destroyed) return;
    if (context.state === 'closed') {
      generation++; cancelFade(); stopBells(); update('unavailable');
    } else if (state === 'playing' && context.state !== 'running') {
      pause(desired ? 'needs-gesture' : 'off');
    }
  }
  function releaseGraph() {
    stopBells();
    context?.removeEventListener('statechange', onContextState);
    for (const source of sources) quietCall(() => source.stop());
    for (const node of nodes) quietCall(() => node.disconnect());
    sources.clear(); nodes.clear();
    if (context) quietCall(() => context.close());
    master = null;
  }
  function buildGraph() {
    context = audioContextFactory();
    context.addEventListener('statechange', onContextState);
    master = own(context.createGain()); master.gain.value = 0;
    const compressor = own(context.createDynamicsCompressor());
    compressor.threshold.value = -24; compressor.knee.value = 24;
    compressor.ratio.value = 6; compressor.attack.value = 0.01; compressor.release.value = 0.4;
    master.connect(compressor); compressor.connect(context.destination);

    for (const [index, frequency] of [110, 164.81, 220].entries()) {
      const oscillator = own(context.createOscillator(), true);
      const gain = own(context.createGain());
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.value = 0.12;
      oscillator.connect(gain); gain.connect(master);
      const lfo = own(context.createOscillator(), true);
      const depth = own(context.createGain());
      lfo.frequency.value = 0.045 + index * 0.013; depth.gain.value = 5;
      lfo.connect(depth); depth.connect(oscillator.detune);
      oscillator.start(); lfo.start();
    }
    const noise = own(context.createBufferSource(), true);
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = random() * 2 - 1;
    noise.buffer = buffer; noise.loop = true;
    const filter = own(context.createBiquadFilter());
    filter.type = 'lowpass'; filter.frequency.value = 420; filter.Q.value = 0.5;
    const windGain = own(context.createGain()); windGain.gain.value = 0.035;
    noise.connect(filter); filter.connect(windGain); windGain.connect(master); noise.start();
  }
  function scheduleBell() {
    if (bellTimer !== null || destroyed || state !== 'playing') return;
    bellTimer = schedule(() => {
      bellTimer = null;
      if (destroyed || state !== 'playing' || hidden || context.state !== 'running') return;
      const time = now(context);
      const oscillator = own(context.createOscillator(), true);
      const gain = own(context.createGain());
      oscillator.type = 'sine';
      oscillator.frequency.value = [440, 554.37, 659.25, 880][Math.min(3, Math.floor(random() * 4))];
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.075, time + 0.04);
      gain.gain.linearRampToValueAtTime(0, time + 2.8);
      oscillator.connect(gain); gain.connect(master); bells.set(oscillator, gain);
      oscillator.onended = () => {
        oscillator.onended = null;
        oscillator.disconnect(); gain.disconnect();
        sources.delete(oscillator); nodes.delete(oscillator); nodes.delete(gain); bells.delete(oscillator);
      };
      oscillator.start(time); oscillator.stop(time + 2.9);
      scheduleBell();
    }, 5500 + random() * 5500);
  }

  function enableFromGesture() {
    if (destroyed || hidden || state === 'unavailable' || state === 'playing') return Promise.resolve();
    if (pending?.token === generation) return pending.promise;
    persist(true);
    cancelFade(); stopBells();
    const token = ++generation;
    update('needs-gesture');
    if (!context) {
      try { buildGraph(); }
      catch {
        releaseGraph(); context = null;
        return Promise.resolve();
      }
    }
    let resume;
    try {
      // Call resume synchronously, while the browser's user activation is still live.
      resume = context.resume();
    } catch {
      fade(0, 0);
      update('needs-gesture');
      return Promise.resolve();
    }
    const promise = Promise.resolve(resume).then(() => {
      if (destroyed || token !== generation) {
        if (!destroyed && pending?.token === token) quietCall(() => context.suspend());
        return;
      }
      if (context.state !== 'running') { update('needs-gesture'); return; }
      fade(MASTER_LEVEL); update('playing'); scheduleBell();
    }).catch(() => {
      if (destroyed || token !== generation) return;
      fade(0, 0); update('needs-gesture');
    }).finally(() => { if (pending?.token === token) pending = null; });
    pending = { token, promise };
    return promise;
  }

  return {
    get state() { return state; },
    enableFromGesture,
    disable() {
      if (destroyed || state === 'unavailable') return;
      persist(false); pause('off');
    },
    setHidden(value) {
      if (destroyed) return;
      hidden = Boolean(value);
      if (hidden && desired && state !== 'unavailable') pause('needs-gesture');
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; generation++; cancelFade(); releaseGraph(); update('off');
    },
  };
}

export function bootAmbientSound(root, windowTarget) {
  const buttons = [...root.querySelectorAll('[data-sound-toggle]')];
  let storage;
  try { storage = windowTarget.localStorage; } catch { /* Private browsing can deny the getter. */ }
  const labels = { off: 'SOUND OFF', 'needs-gesture': 'START SOUND', playing: 'SOUND ON', unavailable: 'SOUND UNAVAILABLE' };
  const render = (state) => {
    for (const button of buttons) {
      button.textContent = labels[state];
      button.setAttribute('aria-pressed', String(state === 'playing'));
      button.disabled = state === 'unavailable';
    }
  };
  const sound = createAmbientSound({
    audioContextFactory: contextFactory(windowTarget), storage,
    setTimeout: windowTarget.setTimeout.bind(windowTarget), clearTimeout: windowTarget.clearTimeout.bind(windowTarget),
    random: (windowTarget.Math ?? Math).random.bind(windowTarget.Math ?? Math),
    onStateChange: render,
  });
  const onClick = (event) => {
    if (!event.isTrusted) return;
    if (sound.state === 'playing') sound.disable();
    else void sound.enableFromGesture();
  };
  const onVisibility = () => sound.setHidden(root.hidden);
  const onPageHide = () => sound.setHidden(true);
  const onPageShow = () => sound.setHidden(root.hidden);
  for (const button of buttons) button.addEventListener('click', onClick);
  root.addEventListener('visibilitychange', onVisibility);
  windowTarget.addEventListener('pagehide', onPageHide);
  windowTarget.addEventListener('pageshow', onPageShow);
  onVisibility(); render(sound.state);
  const destroy = sound.destroy;
  sound.destroy = () => {
    for (const button of buttons) button.removeEventListener('click', onClick);
    root.removeEventListener('visibilitychange', onVisibility);
    windowTarget.removeEventListener('pagehide', onPageHide);
    windowTarget.removeEventListener('pageshow', onPageShow);
    destroy();
  };
  return sound;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootAmbientSound(document, window), { once: true });
  } else {
    bootAmbientSound(document, window);
  }
}
