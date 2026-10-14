// One shared AudioContext, created on the first sound so browsers allow it.
let ctx: AudioContext | null = null;
let enabled = false;
const listeners = new Set<(on: boolean) => void>();

function context() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    // A phone puts the audio to sleep whenever it likes (a call, another app, a locked screen), and only a touch may wake it again.
    const wake = () => {
      if (ctx && ctx.state !== "running") void ctx.resume().catch(() => {});
      if (enabled) holdSpeaker();
    };
    // "click" and "touchend" are the ones an iPhone counts as a real press.
    for (const kind of ["pointerdown", "touchend", "click", "keydown"]) window.addEventListener(kind, wake, { capture: true, passive: true });
    document.addEventListener("visibilitychange", () => (document.visibilityState === "visible" ? wake() : dropSpeaker()));
  }
  // "suspended" is the usual sleep; iPhones also have one of their own called "interrupted".
  if (ctx.state !== "running") void ctx.resume().catch(() => {});
  return ctx;
}
// Runs `play` now if the audio is awake, or the moment it wakes if that is soon.
function awake(play: () => void) {
  const ac = context();
  if (ac.state === "running") return play();
  const asked = performance.now();
  void ac.resume().then(() => performance.now() - asked < 1500 && play(), () => {});
}
// On an iPhone, sound made by a page is silenced by the ring/silent switch unless the page says it is playing something, the way a music app does.
function claimSpeaker() {
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== "playback") session.type = "playback";
  } catch {
    // Not offered here.
  }
}

// That is not always enough (and not offered at all on older iPhones, or inside some in-app browsers).
let hush: HTMLAudioElement | null = null;
const apple = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
function silence(rate: number) {
  // A quarter of a second of nothing, as a WAV at the same rate the rest of the sound runs at.
  const frames = Math.round(rate / 4), bytes = new DataView(new ArrayBuffer(44 + frames * 2));
  const text = (at: number, word: string) => [...word].forEach((ch, k) => bytes.setUint8(at + k, ch.charCodeAt(0)));
  text(0, "RIFF");
  bytes.setUint32(4, 36 + frames * 2, true);
  text(8, "WAVEfmt ");
  bytes.setUint32(16, 16, true);
  bytes.setUint16(20, 1, true);
  bytes.setUint16(22, 1, true);
  bytes.setUint32(24, rate, true);
  bytes.setUint32(28, rate * 2, true);
  bytes.setUint16(32, 2, true);
  bytes.setUint16(34, 16, true);
  text(36, "data");
  bytes.setUint32(40, frames * 2, true);
  let raw = "";
  for (let k = 0; k < bytes.byteLength; k++) raw += String.fromCharCode(bytes.getUint8(k));
  return `data:audio/wav;base64,${btoa(raw)}`;
}
function holdSpeaker() {
  if (!apple()) return;
  try {
    if (!hush) {
      hush = new Audio();
      hush.loop = true;
      hush.preload = "auto";
      hush.setAttribute("playsinline", "");
      hush.setAttribute("x-webkit-airplay", "deny");
      (hush as unknown as { disableRemotePlayback: boolean }).disableRemotePlayback = true;
      hush.src = silence(ctx?.sampleRate ?? 44100);
      hush.load();
    }
    if (hush.paused) void hush.play().catch(() => {});
  } catch {
    // No audio element here: the sound simply follows the silent switch.
  }
}
function dropSpeaker() {
  try {
    hush?.pause();
  } catch {
    // Nothing was playing.
  }
}

// The sound switch in the menu is the last word: off means the site is silent.
export const soundOn = () => enabled;
export function setSound(on: boolean) {
  if (enabled === on) return;
  enabled = on;
  if (on) {
    claimSpeaker();
    context();
    holdSpeaker();
  } else dropSpeaker();
  if (ctx && volume) {
    // Off cuts whatever is still ringing. (Set outright as well as faded: a fade asked of a sleeping phone can be lost.)
    const t = ctx.currentTime;
    volume.gain.cancelScheduledValues(t);
    if (on || ctx.state !== "running") volume.gain.value = on ? 1 : 0;
    else {
      volume.gain.setValueAtTime(volume.gain.value, t);
      volume.gain.linearRampToValueAtTime(0, t + 0.08);
    }
  }
  listeners.forEach((l) => l(on));
}
// For a press that asks for sound.
export const wantSound = () => setSound(true);
export function onSound(listener: (on: boolean) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

// Every sound goes through one gentle compressor, so chords do not clip.
let master: AudioNode | null = null;
let volume: GainNode | null = null;
let roomIn: AudioNode | null = null;
let analyser: AnalyserNode | null = null;
function output(ac: AudioContext) {
  if (!master) {
    const squash = ac.createDynamicsCompressor();
    squash.threshold.value = -16;
    squash.knee.value = 12;
    squash.ratio.value = 4;
    squash.attack.value = 0.004;
    squash.release.value = 0.2;
    volume = ac.createGain();
    volume.gain.value = enabled ? 1 : 0;
    squash.connect(volume).connect(ac.destination);
    analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    analyser.minDecibels = -82;
    analyser.maxDecibels = -16;
    volume.connect(analyser);
    master = squash;
    // The room: two seconds of hiss dying away, which is near enough what a hall does to a clap.
    const rate = ac.sampleRate, len = Math.floor(rate * 2.1);
    const hall = ac.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const data = hall.getChannelData(c);
      let low = 0;
      for (let n = 0; n < len; n++) {
        const t = n / len;
        low += ((Math.random() * 2 - 1) - low) * (0.55 - 0.4 * t); // the echo gets duller as it fades
        data[n] = low * (1 - t) ** 2.6 * (n < rate * 0.012 ? n / (rate * 0.012) : 1);
      }
    }
    const room = ac.createConvolver();
    room.buffer = hall;
    const back = ac.createGain();
    back.gain.value = 0.55;
    room.connect(back).connect(squash);
    roomIn = room;
  }
  poke();
  return master;
}
// Where a note plugs in: straight to the output, and `wet` of it into the room as well.
function plug(ac: AudioContext, wet: number) {
  const dest = output(ac);
  const tap = ac.createGain();
  tap.connect(dest);
  if (wet > 0 && roomIn) {
    const send = ac.createGain();
    send.gain.value = wet;
    tap.connect(send).connect(roomIn);
  }
  return tap;
}

// ---- Telling the rest of the site that something is sounding, and what -------------------------------------
const wakers = new Set<() => void>();
let lastPoke = 0;
function poke() {
  lastPoke = performance.now();
  wakers.forEach((w) => w());
}
// Called whenever a sound starts, so a picture of the sound can wake up.
export function onSoundStart(listener: () => void) {
  wakers.add(listener);
  return () => void wakers.delete(listener);
}
// A recording playing in an <audio> element is not heard by the meter, so its player hands its own reading in.
let fed: { bands: Float32Array; at: number } | null = null;
export function feedMeter(bands: Float32Array) {
  fed = { bands, at: performance.now() };
  // Keep whatever draws the sound awake for as long as there is something to draw.
  if (performance.now() - lastPoke > 250 && bands.some((v) => v > 0.04)) poke();
}
const bins = new Uint8Array(512);
// Fills `out` with how loud each band of pitch is right now (0 to 1, low notes first) and returns the loudest.
export function readMeter(out: Float32Array) {
  const n = out.length;
  let top = 0;
  const recent = performance.now() - lastPoke < 9000;
  if (analyser && ctx && recent) {
    analyser.getByteFrequencyData(bins);
    const hz = ctx.sampleRate / analyser.fftSize;
    for (let b = 0; b < n; b++) {
      // Bands evenly spaced in pitch from 50 Hz to 6 kHz.
      const lo = Math.max(1, Math.floor((50 * 120 ** (b / n)) / hz)), hi = Math.max(lo + 1, Math.ceil((50 * 120 ** ((b + 1) / n)) / hz));
      let most = 0;
      for (let k = lo; k < hi && k < bins.length; k++) most = Math.max(most, bins[k]);
      out[b] = Math.min(1, (most / 255) ** 2.3 * 1.5);
    }
  } else out.fill(0);
  if (fed && performance.now() - fed.at < 160) for (let b = 0; b < n; b++) out[b] = Math.max(out[b], fed.bands[Math.floor((b / n) * fed.bands.length)] ?? 0);
  for (let b = 0; b < n; b++) top = Math.max(top, out[b]);
  return top;
}

// One second of white noise, shared by everything that needs a click, a thump or a cymbal.
let hiss: AudioBuffer | null = null;
function noise(ac: AudioContext) {
  if (!hiss) {
    hiss = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = hiss.getChannelData(0);
    for (let k = 0; k < data.length; k++) data[k] = Math.random() * 2 - 1;
  }
  return hiss;
}
// A burst of that noise through a filter, dying away over `decay` seconds.
function burst(ac: AudioContext, at: number, { type, freq, q = 0.8, gain, decay }: { type: BiquadFilterType; freq: number; q?: number; gain: number; decay: number }) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  src.connect(filter).connect(amp).connect(output(ac));
  src.start(at, Math.random() * 0.5);
  src.stop(at + decay + 0.05);
}
// A sine that dies away, optionally sliding in pitch: the building block for bars, tines and drum heads.
function ping(ac: AudioContext, at: number, from: number, { to = from, slide = 0.1, gain, decay, type = "sine" as OscillatorType }: { to?: number; slide?: number; gain: number; decay: number; type?: OscillatorType }) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + slide);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.003);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(amp).connect(output(ac));
  osc.start(at);
  osc.stop(at + decay + 0.05);
}

// Each instrument: its name, and roughly how loud each harmonic is (drawn in the tuning lab).
export const INSTRUMENTS = {
  piano: { label: "Piano", partials: [1, 0.52, 0.34, 0.2, 0.13, 0.08, 0.05, 0.03], attack: 0.004, length: 3, sustain: false },
  guitar: { label: "Guitar", partials: [1, 0.72, 0.5, 0.38, 0.27, 0.2, 0.13, 0.09, 0.06, 0.04], attack: 0.002, length: 2.4, sustain: false },
  marimba: { label: "Marimba", partials: [1, 0, 0, 0.3, 0, 0, 0, 0, 0, 0.1], attack: 0.002, length: 1.2, sustain: false },
  kalimba: { label: "Kalimba", partials: [1, 0, 0, 0, 0, 0.22, 0, 0, 0, 0.04], attack: 0.002, length: 1.8, sustain: false },
  voice: { label: "Voice", partials: Array.from({ length: 40 }, (_, k) => 1 / (k + 1) ** 1.3), attack: 0.1, length: 1.9, sustain: true },
  pure: { label: "Pure tone", partials: [1], attack: 0.03, length: 2.4, sustain: true },
} as const;
export type Instrument = keyof typeof INSTRUMENTS;

const waves = new Map<string, PeriodicWave>();
function wave(ac: AudioContext, name: Instrument) {
  let w = waves.get(name);
  if (!w) {
    const p = INSTRUMENTS[name].partials;
    const real = new Float32Array(p.length + 1);
    const imag = new Float32Array(p.length + 1);
    p.forEach((a, i) => (imag[i + 1] = a));
    w = ac.createPeriodicWave(real, imag);
    waves.set(name, w);
  }
  return w;
}

// A plucked string, worked out the way a real one behaves (Karplus and Strong's method): a burst of noise goes round and round a short loop, and…
const plucks = new Map<number, { buffer: AudioBuffer; pitch: number }>();
function pluck(ac: AudioContext, freq: number) {
  const key = Math.round(12 * Math.log2(freq / 27.5));
  let made = plucks.get(key);
  if (!made) {
    const rate = 32000, base = 27.5 * 2 ** (key / 12);
    const loop = Math.max(2, Math.round(rate / base));
    const blend = Math.min(0.5, Math.max(0.12, loop / 330)); // high strings lose less on each trip
    const ring = new Float32Array(loop);
    for (let k = 0; k < loop; k++) ring[k] = Math.random() * 2 - 1;
    for (let pass = 0; pass < 2; pass++) for (let k = 0; k < loop; k++) ring[k] = (ring[k] + ring[(k + 1) % loop]) / 2; // a soft fingertip, not a plectrum
    // Plucked a fifth of the way along: the waves that would stand still there are missing from the start.
    const gap = Math.max(1, Math.round(loop * 0.2)), first = ring.slice();
    for (let k = 0; k < loop; k++) ring[k] = first[k] - 0.85 * first[(k + gap) % loop];
    const buffer = ac.createBuffer(1, Math.floor(rate * 3.4), rate);
    const data = buffer.getChannelData(0);
    let at = 0, peak = 0;
    for (let k = 0; k < data.length; k++) {
      const now = ring[at], next = ring[(at + 1) % loop];
      data[k] = now;
      peak = Math.max(peak, Math.abs(now));
      ring[at] = 0.9972 * ((1 - blend) * now + blend * next);
      at = (at + 1) % loop;
    }
    for (let k = 0; k < data.length; k++) data[k] /= peak || 1;
    made = { buffer, pitch: rate / (loop + blend) };
    if (plucks.size > 44) plucks.delete(plucks.keys().next().value as number);
    plucks.set(key, made);
  }
  return made;
}

type Options = { force?: boolean; instrument?: Instrument; gain?: number; length?: number; delay?: number; hold?: boolean };

// The audio clock, for anything that schedules notes ahead of time.
export const audioNow = () => context().currentTime;
// Turns a sound file's bytes into samples (for drawing its waveform; the playing is done by an <audio> element).
export const decodeAudio = (data: ArrayBuffer) => context().decodeAudioData(data);

// A note built by hand from its ingredients: `levels[0]` is how much of the fundamental, `levels[1]` of the harmonic at twice its frequency, and so on.
export function partials(base: number, levels: number[], { gain = 0.3, decay = 2.2 }: { gain?: number; decay?: number } = {}) {
  wantSound();
  try {
    const ac = context();
    const now = ac.currentTime, dest = output(ac);
    levels.forEach((level, k) => {
      const loud = Math.min(1, Math.abs(level)) * gain;
      if (loud < 0.002) return;
      const osc = ac.createOscillator(), amp = ac.createGain();
      const life = decay / (1 + k * 0.3);
      osc.frequency.value = base * (k + 1);
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(loud, now + 0.005);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + life);
      osc.connect(amp).connect(dest);
      osc.start(now);
      osc.stop(now + life + 0.05);
    });
  } catch {
    // No audio available: the picture still moves.
  }
}

// ---- Recorded instruments ------------------------------------------------------------------------------------
// The piano and the guitar are real ones: a few dozen recorded notes each, with the notes between played from
// the nearest recording a touch faster or slower. They are fetched the first time the instrument is wanted;
// until they arrive, the built versions further down stand in.
//   Piano: the Salamander Grand Piano by Alexander Holm (CC BY 3.0), one note every three semitones, A0 to C8.
//   Guitar: a steel-string acoustic from the University of Iowa Electronic Music Studios, as edited for
//           tonejs-instruments by Nicholaus Brosowsky (CC BY 3.0), one note every three semitones, D2 to D5.
type Kit = { notes: { midi: number; name: string }[]; got: Map<number, { buffer: AudioBuffer; lead: number }>; state: "idle" | "loading" | "ready" | "failed"; wait: Promise<boolean> | null };
const STEPS = ["A", "C", "Ds", "Fs"], GSTEPS = ["D", "F", "Gs", "B"];
const KITS: Record<"piano" | "guitar", Kit> = {
  piano: { notes: Array.from({ length: 30 }, (_, k) => ({ midi: 21 + k * 3, name: `${STEPS[k % 4]}${Math.floor((k + 3) / 4)}` })), got: new Map(), state: "idle", wait: null },
  guitar: { notes: Array.from({ length: 13 }, (_, k) => ({ midi: 38 + k * 3, name: `${GSTEPS[k % 4]}${2 + Math.floor(k / 4)}` })), got: new Map(), state: "idle", wait: null },
};
export function loadSounds(which: "piano" | "guitar") {
  const kit = KITS[which];
  kit.wait ??= (async () => {
    kit.state = "loading";
    try {
      const ac = context();
      await Promise.all(
        kit.notes.map(async (smp) => {
          const res = await fetch(`/sounds/${which}/${smp.name}.mp3`);
          if (!res.ok) throw new Error("missing");
          const buffer = await ac.decodeAudioData(await res.arrayBuffer());
          // Skip the sliver of silence an MP3 starts with, so the note lands when the key does.
          const data = buffer.getChannelData(0);
          let first = 0;
          while (first < data.length && Math.abs(data[first]) < 0.006) first++;
          kit.got.set(smp.midi, { buffer, lead: Math.max(0, first / buffer.sampleRate - 0.002) });
        }),
      );
      kit.state = "ready";
      return true;
    } catch {
      kit.state = "failed";
      return false;
    }
  })();
  return kit.wait;
}
export const loadPiano = () => loadSounds("piano");
// The recording nearest a pitch, and how much faster or slower to play it. Nothing until the kit has arrived.
function recorded(which: "piano" | "guitar", freq: number) {
  const kit = KITS[which];
  if (kit.state === "idle") void loadSounds(which);
  if (kit.state !== "ready") return null;
  const midi = 69 + 12 * Math.log2(freq / 440);
  const near = kit.notes.reduce((best, smp) => (Math.abs(smp.midi - midi) < Math.abs(best.midi - midi) ? smp : best));
  const made = kit.got.get(near.midi);
  return made ? { ...made, rate: 2 ** ((midi - near.midi) / 12) } : null;
}

const NOTHING = () => {};
// Lets go of a sounding note: a quick fade, as a damper or a hand would.
function letGo(ac: AudioContext, amp: GainNode, stops: AudioScheduledSourceNode[], fade: number) {
  let end = Infinity;
  return (at?: number) => {
    const t = Math.max(ac.currentTime, at ?? 0);
    if (t >= end - 0.01) return; // it is already ending by then
    end = t;
    const quick = at === undefined ? Math.min(fade, 0.06) : fade;
    try {
      amp.gain.cancelScheduledValues(t);
      amp.gain.setTargetAtTime(0, t, quick / 3);
    } catch {
      // Already finished.
    }
    for (const n of stops) {
      try {
        n.stop(t + quick * 2 + 0.05);
      } catch {
        // Already stopped.
      }
    }
  };
}

// Plays one note, and hands back a way to let go of it.
export function note(freq: number, { force = false, instrument = "guitar", gain = 0.2, length, delay = 0, hold = false }: Options = {}): () => void {
  if (!enabled && !force) return NOTHING;
  if (force) wantSound();
  if (context().state !== "running") {
    // The audio is asleep: play as soon as it wakes, unless the note has been let go by then.
    let stopped = false, release = NOTHING;
    awake(() => !stopped && (release = note(freq, { force, instrument, gain, length, delay, hold })));
    return () => {
      stopped = true;
      release();
    };
  }
  try {
    const ac = context();
    const spec = INSTRUMENTS[instrument];
    const now = ac.currentTime + Math.max(0, delay);

    if (instrument === "guitar") {
      const real = recorded("guitar", freq);
      if (real) {
        const src = ac.createBufferSource();
        src.buffer = real.buffer;
        src.playbackRate.value = real.rate;
        const amp = ac.createGain();
        amp.gain.setValueAtTime(Math.min(1.8, gain * 6), now);
        src.connect(amp).connect(plug(ac, 0.24));
        src.start(now, real.lead);
        const release = letGo(ac, amp, [src], 0.14);
        if (!hold && length !== undefined) release(now + length);
        return release;
      }
      // Until the recordings arrive: a string worked out from first principles.
      const { buffer, pitch } = pluck(ac, freq);
      const src = ac.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = freq / pitch;
      // The box: its air (around 100 Hz), its top (around 200 Hz) and a little brightness, then a roll-off.
      const air = ac.createBiquadFilter(), top = ac.createBiquadFilter(), nose = ac.createBiquadFilter(), roof = ac.createBiquadFilter();
      air.type = top.type = nose.type = "peaking";
      air.frequency.value = 105;
      air.Q.value = 1.6;
      air.gain.value = 5;
      top.frequency.value = 215;
      top.Q.value = 1.3;
      top.gain.value = 4;
      nose.frequency.value = 2600;
      nose.Q.value = 0.9;
      nose.gain.value = 3;
      roof.type = "lowpass";
      roof.frequency.value = 6800;
      const amp = ac.createGain();
      const dur = Math.min(length ?? 9, 3.3 / (freq / pitch));
      amp.gain.setValueAtTime(gain * 1.6, now);
      amp.gain.setValueAtTime(gain * 1.6, now + Math.max(0.05, dur - 0.3));
      amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(air).connect(top).connect(nose).connect(roof).connect(amp).connect(plug(ac, 0.22));
      src.start(now);
      src.stop(now + dur + 0.05);
      // The fingertip leaving the string.
      burst(ac, now, { type: "bandpass", freq: Math.min(4200, freq * 6), q: 0.8, gain: gain * 0.22, decay: 0.012 });
      return letGo(ac, amp, [src], 0.12);
    }

    if (instrument === "marimba") {
      // A wooden bar: the note, a quick overtone two octaves up (bars are carved to put it there), and the mallet.
      const ring = Math.min(1.6, Math.max(0.35, 0.95 * Math.sqrt(262 / freq)));
      ping(ac, now, freq, { gain: gain * 1.5, decay: ring });
      ping(ac, now, freq * 4, { gain: gain * 0.4, decay: ring * 0.22 });
      ping(ac, now, freq * 9.2, { gain: gain * 0.12, decay: 0.06 });
      burst(ac, now, { type: "lowpass", freq: 900, gain: gain * 0.5, decay: 0.03 });
      return NOTHING;
    }

    if (instrument === "kalimba") {
      // A sprung steel tine: nearly a pure tone, with a glassy overtone that is not a whole multiple, and a thumbnail click.
      ping(ac, now, freq, { gain: gain * 1.5, decay: 2.2 });
      ping(ac, now, freq * 2, { gain: gain * 0.12, decay: 0.9 });
      ping(ac, now, freq * 5.9, { gain: gain * 0.22, decay: 0.3 });
      burst(ac, now, { type: "highpass", freq: 2500, gain: gain * 0.35, decay: 0.012 });
      return NOTHING;
    }

    if (instrument === "piano") {
      const made = recorded("piano", freq);
      if (made) {
        const src = ac.createBufferSource();
        src.buffer = made.buffer;
        src.playbackRate.value = made.rate;
        const amp = ac.createGain();
        // A soft note is not only quieter but duller: the hammer is slower.
        const soft = ac.createBiquadFilter();
        soft.type = "lowpass";
        soft.frequency.value = Math.min(16000, 2600 + gain * 42000);
        amp.gain.setValueAtTime(Math.min(1.6, gain * 5.2), now);
        src.connect(soft).connect(amp).connect(plug(ac, 0.09));
        src.start(now, made.lead);
        const release = letGo(ac, amp, [src], 0.13); // the damper coming down
        if (!hold && length !== undefined) release(now + length);
        return release;
      }
      // Until the recordings arrive: two strings a hair out of tune with each other, a hammer thump, a bright start that mellows, and a ring that lasts…
      const natural = Math.min(5.5, Math.max(1.1, 5.2 - 0.8 * Math.log2(freq / 55)));
      const dur = hold ? natural : Math.min(natural, length ?? natural);
      const amp = ac.createGain();
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain * 1.25, now + 0.004);
      amp.gain.exponentialRampToValueAtTime(gain * 0.5, now + Math.min(0.22, dur * 0.3));
      amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      const filter = ac.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.4;
      filter.frequency.setValueAtTime(Math.min(11000, freq * 9 + 600), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(500, Math.min(6000, freq * 2.4)), now + Math.min(1.2, dur * 0.6));
      const apart = freq < 130 ? 0.6 : 1.4; // cents
      const strings = [-apart, apart].map((cents) => {
        const osc = ac.createOscillator();
        osc.setPeriodicWave(wave(ac, "piano"));
        osc.frequency.value = freq;
        osc.detune.value = cents;
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + dur + 0.05);
        return osc;
      });
      filter.connect(amp).connect(plug(ac, 0.2));
      burst(ac, now, { type: "bandpass", freq: Math.min(5000, freq * 5 + 400), q: 0.7, gain: gain * 0.5, decay: 0.03 });
      return letGo(ac, amp, strings, 0.2);
    }

    if (instrument === "voice") {
      // Three singers on "ah".
      const dur = hold ? 12 : (length ?? spec.length);
      const high = freq > 290;
      const shape: [number, number, number][] = high ? [[880, 90, 1], [1250, 100, 0.5], [2850, 150, 0.2], [3900, 200, 0.07]] : [[700, 80, 1], [1100, 90, 0.45], [2500, 130, 0.2], [3400, 170, 0.06]];
      if (freq > shape[0][0] * 0.92) shape[0][0] = freq * 1.08; // a soprano opens her mouth to keep up with the note
      const throat = ac.createGain(), mouth = ac.createGain();
      shape.forEach(([f, width, level]) => {
        const formant = ac.createBiquadFilter(), share = ac.createGain();
        formant.type = "bandpass";
        formant.frequency.value = f;
        formant.Q.value = f / width;
        share.gain.value = level * 5;
        throat.connect(formant).connect(share).connect(mouth);
      });
      const chest = ac.createGain();
      chest.gain.value = 0.1;
      throat.connect(chest).connect(mouth);
      const running: AudioScheduledSourceNode[] = [];
      [[-7, 5.2, 0, 0.75], [0, 5.7, 0.012, 1], [8, 6.1, 0.022, 0.75]].forEach(([cents, rate, late, level]) => {
        const folds = ac.createOscillator(), share = ac.createGain();
        folds.setPeriodicWave(wave(ac, "voice"));
        folds.frequency.value = freq;
        folds.detune.setValueAtTime(cents - 35, now + late);
        folds.detune.linearRampToValueAtTime(cents, now + late + 0.1);
        const vibrato = ac.createOscillator(), depth = ac.createGain(), drift = ac.createOscillator(), wander = ac.createGain();
        vibrato.frequency.value = rate;
        depth.gain.setValueAtTime(0, now);
        depth.gain.setValueAtTime(0, now + 0.28);
        depth.gain.linearRampToValueAtTime(freq * 0.009, now + 0.9);
        drift.frequency.value = 0.6 + rate * 0.07;
        wander.gain.value = freq * 0.0025;
        vibrato.connect(depth).connect(folds.frequency);
        drift.connect(wander).connect(folds.frequency);
        share.gain.value = level * 0.42;
        folds.connect(share).connect(throat);
        [folds, vibrato, drift].forEach((n) => (n.start(now + late), n.stop(now + dur + 0.2), running.push(n)));
      });
      const breath = ac.createBufferSource(), air = ac.createGain();
      breath.buffer = noise(ac);
      breath.loop = true;
      air.gain.value = 0.03;
      breath.connect(air).connect(throat);
      breath.start(now);
      breath.stop(now + dur + 0.2);
      running.push(breath);
      const roof = ac.createBiquadFilter();
      roof.type = "lowpass";
      roof.frequency.value = 6500;
      const amp = ac.createGain();
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.11);
      amp.gain.setValueAtTime(gain, now + Math.max(0.12, dur - 0.25));
      amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      mouth.connect(roof).connect(amp).connect(plug(ac, 0.5));
      return letGo(ac, amp, running, 0.2);
    }

    // A pure tone: one oscillator with a slow envelope.
    const dur = hold ? 12 : (length ?? spec.length);
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.setPeriodicWave(wave(ac, instrument));
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + Math.min(spec.attack, dur * 0.3));
    amp.gain.setValueAtTime(gain, now + dur * 0.55);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(amp).connect(plug(ac, 0.1));
    osc.start(now);
    osc.stop(now + dur + 0.1);
    return letGo(ac, amp, [osc], 0.15);
  } catch {
    // No audio available; the visuals still work.
    return NOTHING;
  }
}

// The sound of sound being switched on: a slow, open chord of soft bells rising out of nothing into a long room.
export function chime() {
  awake(() => {
    try {
      const ac = context(), dest = plug(ac, 0.9), now = ac.currentTime + 0.02;
      // D, A, F sharp, E and a high A: a major chord with its ninth, spread wide, each note a breath after the last.
      [146.83, 220, 369.99, 659.25, 880].forEach((f, k) => {
        const at = now + k * 0.16, loud = 0.085 / (1 + k * 0.25);
        [-3, 3].forEach((cents) => {
          const osc = ac.createOscillator(), amp = ac.createGain();
          osc.frequency.value = f;
          osc.detune.value = cents;
          amp.gain.setValueAtTime(0.0001, at);
          amp.gain.exponentialRampToValueAtTime(loud, at + 0.35);
          amp.gain.exponentialRampToValueAtTime(0.0001, at + 3.6);
          osc.connect(amp).connect(dest);
          osc.start(at);
          osc.stop(at + 3.7);
        });
        // A glint an octave above each, gone almost at once.
        ping(ac, at + 0.05, f * 2, { gain: loud * 0.35, decay: 0.9 });
      });
    } catch {
      // No audio available.
    }
  });
}

// A drum kit, synthesised: heads are sine waves that drop in pitch, cymbals and snare wires are filtered noise.
export type Drum = "kick" | "snare" | "hat" | "open" | "tom" | "tom2" | "floor" | "crash" | "ride";
export function drum(kind: Drum, { gain = 0.5, delay = 0 }: { gain?: number; delay?: number } = {}) {
  if (!enabled) return;
  try {
    const ac = context();
    const at = ac.currentTime + Math.max(0, delay);
    if (kind === "kick") {
      ping(ac, at, 150, { to: 44, slide: 0.11, gain: gain * 1.7, decay: 0.38 });
      burst(ac, at, { type: "lowpass", freq: 1800, gain: gain * 0.35, decay: 0.015 });
    } else if (kind === "snare") {
      ping(ac, at, 220, { to: 160, slide: 0.06, gain: gain * 0.7, decay: 0.12, type: "triangle" });
      burst(ac, at, { type: "highpass", freq: 1400, gain: gain * 0.9, decay: 0.2 });
    } else if (kind === "hat") burst(ac, at, { type: "highpass", freq: 7500, gain: gain * 0.5, decay: 0.05 });
    else if (kind === "open") burst(ac, at, { type: "highpass", freq: 6500, gain: gain * 0.45, decay: 0.38 });
    else if (kind === "tom") ping(ac, at, 230, { to: 150, slide: 0.12, gain: gain * 1.2, decay: 0.3 });
    else if (kind === "tom2") ping(ac, at, 180, { to: 115, slide: 0.14, gain: gain * 1.2, decay: 0.34 });
    else if (kind === "floor") ping(ac, at, 125, { to: 78, slide: 0.16, gain: gain * 1.4, decay: 0.45 });
    else if (kind === "crash") {
      burst(ac, at, { type: "highpass", freq: 3800, gain: gain * 0.6, decay: 1.5 });
      burst(ac, at, { type: "bandpass", freq: 5200, q: 2, gain: gain * 0.35, decay: 0.9 });
    } else if (kind === "ride") {
      burst(ac, at, { type: "highpass", freq: 6000, gain: gain * 0.28, decay: 0.55 });
      ping(ac, at, 5300, { gain: gain * 0.07, decay: 0.5, type: "triangle" });
    }
  } catch {
    // No audio available.
  }
}
