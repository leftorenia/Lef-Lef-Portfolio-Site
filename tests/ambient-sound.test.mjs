import test from 'node:test';
import assert from 'node:assert/strict';
import * as ambient from '../assets/js/ambient-sound.js';

const KEY = 'lef-lef-portfolio:ambient-enabled';
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function events() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type, event = {}) { for (const fn of listeners.get(type) ?? []) fn(event); },
    get listenerCount() { return [...listeners.values()].reduce((n, set) => n + set.size, 0); },
  };
}

function parameter(value = 0) {
  return { value, calls: [],
    setValueAtTime(value, time) { this.calls.push(['set', value, time]); this.value = value; },
    linearRampToValueAtTime(value, time) { this.calls.push(['ramp', value, time]); },
    cancelScheduledValues(time) { this.calls.push(['cancel', time]); },
    cancelAndHoldAtTime(time) { this.calls.push(['hold', time]); },
  };
}

function fixture(stored = null) {
  let sequence = 0;
  let time = 0;
  const timers = new Map();
  const nodes = [];
  const writes = [];
  const storage = { getItem(key) { assert.equal(key, KEY); return stored; }, setItem(key, value) { writes.push([key, value]); stored = value; } };
  const context = { ...events(), state: 'suspended', currentTime: 0, sampleRate: 100,
    destination: { kind: 'destination' }, resumes: 0, suspends: 0, closes: 0,
    async resume() { this.resumes++; this.state = 'running'; this.emit('statechange'); },
    async suspend() { this.suspends++; this.state = 'suspended'; this.emit('statechange'); },
    async close() { this.closes++; this.state = 'closed'; this.emit('statechange'); },
    createBuffer(channels, length, rate) { assert.equal(channels, 1); assert.equal(rate, this.sampleRate); const data = new Float32Array(length); return { getChannelData: () => data }; },
  };
  for (const [method, kind] of Object.entries({ createGain: 'gain', createOscillator: 'oscillator', createBufferSource: 'noise', createBiquadFilter: 'filter', createDynamicsCompressor: 'compressor' })) {
    context[method] = () => {
      const node = { kind, connections: [], starts: [], stops: [], disconnected: false,
        gain: parameter(1), frequency: parameter(440), detune: parameter(), Q: parameter(1),
        threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter(),
        connect(target) { this.connections.push(target); return target; },
        disconnect() { this.disconnected = true; },
        start(at = 0) { this.starts.push(at); }, stop(at = 0) { this.stops.push(at); },
      };
      nodes.push(node); return node;
    };
  }
  const f = { context, nodes, timers, storage, writes, factories: 0,
    options: { storage, audioContextFactory() { f.factories++; return context; }, random: () => 0.25,
      now: () => context.currentTime,
      setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, due: time + delay }); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    async advance(ms) {
      const end = time + ms;
      for (;;) {
        const next = [...timers].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        time = next[1].due; context.currentTime = time / 1000;
        timers.delete(next[0]); next[1].fn(); await flush();
      }
      time = end; context.currentTime = time / 1000; await flush();
    },
    get stored() { return stored; },
    get master() { return nodes.find((n) => n.kind === 'gain' && n.connections.some((t) => t.kind === 'compressor')); },
  };
  return f;
}

function bootFixture(stored, supported = true) {
  const f = fixture(stored);
  const button = { ...events(), textContent: '', disabled: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const root = { ...events(), hidden: false, querySelectorAll: () => [button] };
  const win = { ...events(), localStorage: f.storage, setTimeout: f.options.setTimeout, clearTimeout: f.options.clearTimeout,
    Math: { random: f.options.random } };
  if (supported) win.AudioContext = function () { f.factories++; return f.context; };
  return { ...f, f, button, root, win };
}

test('preference uses the repository namespace and fails closed for absent, malformed, or throwing storage', () => {
  assert.equal(ambient.AMBIENT_STORAGE_KEY, KEY);
  for (const [value, want] of [[null, false], ['false', false], ['true', true], ['on', false]]) {
    assert.equal(ambient.readAmbientPreference(fixture(value).storage), want);
  }
  assert.equal(ambient.readAmbientPreference(), false);
  assert.equal(ambient.readAmbientPreference({ getItem() { throw Error('blocked'); } }), false);
});

test('construction and stored intent never create or resume audio', () => {
  for (const [stored, want] of [[null, 'off'], ['true', 'needs-gesture']]) {
    const f = fixture(stored); const sound = ambient.createAmbientSound(f.options);
    assert.equal(sound.state, want); assert.equal(f.factories, 0); assert.equal(f.context.resumes, 0); assert.equal(f.timers.size, 0);
    sound.destroy();
  }
});

test('gesture creates generated pad, LFO, filtered noise and a compressor with a quiet one-second master fade', async () => {
  const f = fixture(); const sound = ambient.createAmbientSound(f.options);
  await sound.enableFromGesture();
  assert.equal(sound.state, 'playing'); assert.equal(f.factories, 1); assert.equal(f.context.resumes, 1); assert.equal(f.stored, 'true');
  const oscillators = f.nodes.filter((n) => n.kind === 'oscillator');
  assert.ok(oscillators.filter((n) => n.frequency.value >= 40 && n.frequency.value <= 400).length >= 2);
  assert.ok(oscillators.some((n) => n.frequency.value > 0 && n.frequency.value < 1));
  const noise = f.nodes.find((n) => n.kind === 'noise');
  assert.equal(noise.loop, true); assert.ok(noise.buffer.getChannelData(0).some((v) => v !== 0));
  assert.ok(noise.connections.some((n) => n.kind === 'filter' && n.type === 'lowpass'));
  const compressor = f.nodes.find((n) => n.kind === 'compressor');
  assert.deepEqual(compressor.connections, [f.context.destination]);
  assert.ok(f.master); const ramp = f.master.gain.calls.find((c) => c[0] === 'ramp');
  assert.ok(ramp[1] > 0 && ramp[1] <= 0.06); assert.equal(ramp[2], 1);
  assert.ok(f.nodes.filter((n) => n.kind === 'oscillator' || n.kind === 'noise').every((n) => n.starts.length === 1));
  assert.equal(f.timers.size, 1); sound.destroy();
});

test('resume rejection preserves On and a later gesture retries the same graph', async () => {
  const f = fixture(); const sound = ambient.createAmbientSound(f.options);
  f.context.resume = async () => { f.context.resumes++; throw Error('gesture expired'); };
  await sound.enableFromGesture(); const count = f.nodes.length;
  assert.equal(sound.state, 'needs-gesture'); assert.equal(f.stored, 'true'); assert.equal(f.timers.size, 0);
  f.context.resume = async () => { f.context.resumes++; f.context.state = 'running'; };
  await sound.enableFromGesture();
  assert.equal(sound.state, 'playing'); assert.equal(f.factories, 1); assert.equal(f.nodes.length, count);
  assert.ok(f.writes.every(([, value]) => value === 'true')); sound.destroy();
});

test('constructor rejection is retryable while missing API is unavailable', async () => {
  const f = fixture(); let attempts = 0;
  const sound = ambient.createAmbientSound({ ...f.options, audioContextFactory() { if (++attempts === 1) throw Error('blocked'); return f.context; } });
  await sound.enableFromGesture(); assert.equal(sound.state, 'needs-gesture'); assert.equal(f.stored, 'true');
  await sound.enableFromGesture(); assert.equal(sound.state, 'playing'); sound.destroy();
  const missing = ambient.createAmbientSound({ audioContextFactory: null });
  assert.equal(missing.state, 'unavailable'); await missing.enableFromGesture(); assert.equal(missing.state, 'unavailable'); missing.destroy();
});

test('disable fades to silence before suspending, stops the scheduler and stores Off', async () => {
  const f = fixture(); const sound = ambient.createAmbientSound(f.options); await sound.enableFromGesture();
  sound.disable(); assert.equal(sound.state, 'off'); assert.equal(f.stored, 'false'); assert.equal(f.context.suspends, 0);
  assert.deepEqual(f.master.gain.calls.at(-1), ['ramp', 0, 1]);
  await f.advance(999); assert.equal(f.context.suspends, 0);
  await f.advance(1); assert.equal(f.context.suspends, 1); assert.equal(f.timers.size, 0); sound.destroy();
});

test('repeated and rapid toggles reuse the base graph and one scheduler', async () => {
  const f = fixture(); const sound = ambient.createAmbientSound(f.options); await sound.enableFromGesture();
  const count = f.nodes.length;
  for (let i = 0; i < 6; i++) {
    sound.disable(); if (i % 2) await f.advance(1100);
    await sound.enableFromGesture(); await sound.enableFromGesture();
    assert.equal(f.nodes.length, count); assert.equal(f.timers.size, 1);
  }
  await f.advance(1100); assert.equal(f.context.state, 'running'); assert.equal(f.factories, 1);
  for (const [, value, time] of f.master.gain.calls.filter((c) => ['set', 'ramp'].includes(c[0]))) {
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 0.06); assert.ok(Number.isFinite(time));
  }
  sound.destroy();
});

test('scheduler generates short bells, releases ended nodes and never schedules while off', async () => {
  const f = fixture(); const sound = ambient.createAmbientSound(f.options); await sound.enableFromGesture();
  const count = f.nodes.length; await f.advance(15000);
  const bells = f.nodes.slice(count).filter((n) => n.kind === 'oscillator'); assert.ok(bells.length > 0);
  for (const bell of bells) {
    assert.ok(bell.stops[0] > bell.starts[0] && bell.stops[0] - bell.starts[0] <= 4);
    bell.onended(); assert.equal(bell.disconnected, true); assert.ok(bell.connections.every((n) => n.disconnected));
  }
  assert.equal(f.timers.size, 1); sound.disable(); await f.advance(1000);
  const stoppedCount = f.nodes.length; await f.advance(60000); assert.equal(f.nodes.length, stoppedCount); sound.destroy();
});

test('visibility requires another gesture, keeps On, and never resumes on return', async () => {
  const f = fixture(); const sound = ambient.createAmbientSound(f.options); await sound.enableFromGesture();
  sound.setHidden(true); assert.equal(sound.state, 'needs-gesture'); assert.equal(f.stored, 'true');
  await f.advance(1000); assert.equal(f.context.state, 'suspended'); assert.equal(f.timers.size, 0);
  sound.setHidden(false); assert.equal(f.context.resumes, 1); assert.equal(sound.state, 'needs-gesture');
  await sound.enableFromGesture(); assert.equal(sound.state, 'playing'); sound.destroy();
});

test('hidden startup, rejected writes and duplicate pending clicks remain safe', async () => {
  const f = fixture(); f.storage.setItem = () => { throw Error('blocked'); };
  const sound = ambient.createAmbientSound(f.options); sound.setHidden(true); await sound.enableFromGesture();
  assert.equal(f.factories, 0); sound.setHidden(false);
  let resolve; f.context.resume = () => { f.context.resumes++; return new Promise((done) => { resolve = () => { f.context.state = 'running'; done(); }; }); };
  const first = sound.enableFromGesture(); const second = sound.enableFromGesture();
  assert.equal(f.context.resumes, 1); resolve(); await Promise.all([first, second]);
  assert.equal(sound.state, 'playing'); assert.equal(f.timers.size, 1); sound.destroy();
});

for (const action of ['disable', 'hide', 'destroy']) {
  test(`late resume cannot restart sound after ${action}`, async () => {
    const f = fixture(); let resolve;
    f.context.resume = () => new Promise((done) => { resolve = () => { f.context.state = 'running'; done(); }; });
    const sound = ambient.createAmbientSound(f.options); const pending = sound.enableFromGesture();
    if (action === 'hide') sound.setHidden(true); else sound[action]();
    resolve(); await pending; await f.advance(1500);
    assert.notEqual(sound.state, 'playing'); assert.equal(f.timers.size, 0);
    assert.ok(f.master.gain.calls.filter((c) => c[0] === 'ramp').every((c) => c[1] === 0));
    if (action !== 'destroy') assert.equal(f.context.state, 'suspended');
    sound.destroy();
  });
}

test('external context interruption updates state and cannot autoplay when running again', async () => {
  const f = fixture(); const sound = ambient.createAmbientSound(f.options); await sound.enableFromGesture();
  f.context.state = 'interrupted'; f.context.emit('statechange');
  assert.equal(sound.state, 'needs-gesture'); assert.equal(f.stored, 'true');
  f.context.state = 'running'; f.context.emit('statechange'); await f.advance(1000);
  assert.equal(sound.state, 'needs-gesture'); assert.equal(f.context.resumes, 1); assert.equal(f.context.state, 'suspended'); sound.destroy();
});

test('destroy releases all sources, nodes, timers and context listeners exactly once', async () => {
  const f = fixture(); const sound = ambient.createAmbientSound(f.options); await sound.enableFromGesture(); await f.advance(8000);
  sound.disable(); sound.destroy(); sound.destroy(); await flush();
  assert.equal(f.timers.size, 0); assert.equal(f.context.closes, 1); assert.equal(f.context.listenerCount, 0);
  assert.ok(f.nodes.every((n) => n.disconnected));
  assert.ok(f.nodes.filter((n) => n.kind === 'oscillator' || n.kind === 'noise').every((n) => n.stops.length >= 1));
  await sound.enableFromGesture(); assert.equal(f.factories, 1); assert.equal(f.timers.size, 0);
});

test('partially failed graph construction releases its nodes and retries with a fresh context', async () => {
  const broken = fixture(); const good = fixture(); let attempts = 0;
  broken.context.createBuffer = () => { throw Error('allocation failed'); };
  const sound = ambient.createAmbientSound({ ...good.options, audioContextFactory: () => (++attempts === 1 ? broken.context : good.context) });
  await sound.enableFromGesture();
  assert.equal(sound.state, 'needs-gesture'); assert.equal(broken.context.closes, 1);
  assert.ok(broken.nodes.every((node) => node.disconnected)); assert.equal(broken.context.listenerCount, 0);
  await sound.enableFromGesture(); assert.equal(sound.state, 'playing'); assert.equal(attempts, 2); sound.destroy();
});

test('a resume resolving after the hidden fade and return cannot leave a running context', async () => {
  const f = fixture(); let resolve;
  f.context.resume = () => new Promise((done) => { resolve = () => { f.context.state = 'running'; done(); }; });
  const sound = ambient.createAmbientSound(f.options); const pending = sound.enableFromGesture();
  sound.setHidden(true); await f.advance(1100); sound.setHidden(false); resolve(); await pending;
  assert.equal(sound.state, 'needs-gesture'); assert.equal(f.context.state, 'suspended'); assert.equal(f.timers.size, 0); sound.destroy();
});

test('boot reflects all four states and owns click, visibility and page lifecycle listeners', async () => {
  const { f, button, root, win } = bootFixture('true'); const sound = ambient.bootAmbientSound(root, win);
  assert.equal(f.factories, 0); assert.equal(button.textContent, 'START SOUND'); assert.equal(button.attrs['aria-pressed'], 'false');
  button.emit('click', { isTrusted: false }); await flush(); assert.equal(f.factories, 0);
  button.emit('click', { isTrusted: true }); await flush();
  assert.equal(button.textContent, 'SOUND ON'); assert.equal(button.attrs['aria-pressed'], 'true');
  root.hidden = true; root.emit('visibilitychange'); await f.advance(1000);
  assert.equal(button.textContent, 'START SOUND'); assert.equal(button.attrs['aria-pressed'], 'false');
  root.hidden = false; root.emit('visibilitychange'); assert.equal(f.context.resumes, 1);
  button.emit('click', { isTrusted: true }); await flush(); button.emit('click', { isTrusted: true });
  assert.equal(button.textContent, 'SOUND OFF'); assert.equal(button.attrs['aria-pressed'], 'false');
  sound.destroy(); assert.equal(button.listenerCount + root.listenerCount + win.listenerCount, 0);
  const unsupported = bootFixture(null, false); const missing = ambient.bootAmbientSound(unsupported.root, unsupported.win);
  assert.equal(unsupported.button.textContent, 'SOUND UNAVAILABLE'); assert.equal(unsupported.button.disabled, true); assert.equal(unsupported.button.attrs['aria-pressed'], 'false'); missing.destroy();
});

test('boot tolerates a blocked localStorage getter and pagehide suspends without losing the UI', async () => {
  const { f, button, root, win } = bootFixture(); Object.defineProperty(win, 'localStorage', { get() { throw Error('denied'); } });
  const sound = ambient.bootAmbientSound(root, win); assert.equal(button.textContent, 'SOUND OFF');
  button.emit('click', { isTrusted: true }); await flush(); win.emit('pagehide'); await f.advance(1000);
  assert.equal(sound.state, 'needs-gesture'); win.emit('pageshow');
  assert.equal(f.context.resumes, 1); button.emit('click', { isTrusted: true }); await flush(); assert.equal(sound.state, 'playing'); sound.destroy();
});
