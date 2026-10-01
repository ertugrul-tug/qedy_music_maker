import * as Tone from 'tone';
import { generatePattern } from './generator.js';
import { INSTRUMENTS, INSTRUMENT_KEYS, DEFAULT_INSTRUMENT } from './instruments.js';

export const DEFAULT_STEPS = 32; // 2 bars of 16th notes — a short loop
export const LOW_MIDI = 48; // C3
export const HIGH_MIDI = 83; // B5
// The piano roll shows a wider range than a track's default generator range (C2..B6)
// so notes played on other octaves of the live keyboard are visible and editable.
export const GRID_LOW = 36;
export const GRID_HIGH = 95;
export const PITCH_COUNT = GRID_HIGH - GRID_LOW + 1;

const SYNTH_CLASSES = {
  Synth: Tone.Synth,
  MonoSynth: Tone.MonoSynth,
  FMSynth: Tone.FMSynth,
  AMSynth: Tone.AMSynth,
  MembraneSynth: Tone.MembraneSynth,
  MetalSynth: Tone.MetalSynth,
};

let nextTrackId = 1;

export function midiToNoteName(midi) {
  return Tone.Frequency(midi, 'midi').toNote();
}

export function createTrack(name = `Track ${nextTrackId}`, steps = DEFAULT_STEPS) {
  const track = {
    id: nextTrackId++,
    name,
    instrument: DEFAULT_INSTRUMENT,
    volume: -6,
    muted: false,
    solo: false,
    pan: 0, // -1 (left) .. 1 (right)
    reverb: 0, // send levels 0..1 into the shared reverb / delay buses
    delay: 0,
    // Pitch range used by the random generator (does not restrict manual editing)
    rangeLow: LOW_MIDI,
    rangeHigh: HIGH_MIDI,
    // cells[step] = Set of midi note numbers active at that step
    cells: Array.from({ length: steps }, () => new Set()),
    // Optional note lengths in steps, keyed "step:midi"; a missing key means 1 step.
    lengths: new Map(),
    // Optional note velocities 0..1, same keys; a missing key means full velocity (1).
    velocities: new Map(),
  };
  return track;
}

export function buildVoice(instrumentKey) {
  const preset = INSTRUMENTS[instrumentKey] || INSTRUMENTS[DEFAULT_INSTRUMENT];
  const SynthClass = SYNTH_CLASSES[preset.synth] || Tone.Synth;
  return new Tone.PolySynth(SynthClass, preset.options);
}

// Shared effect buses; each track feeds them through its own send level.
function createFx(dest) {
  return {
    reverb: new Tone.Reverb({ decay: 3, wet: 1 }).connect(dest),
    delay: new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.35, wet: 1 }).connect(dest),
  };
}

// synth -> volume -> panner -> dest, with post-fader sends to the reverb and delay buses.
function createChannel(track, dest, fx) {
  const synth = buildVoice(track.instrument);
  const volume = new Tone.Volume(0);
  const panner = new Tone.Panner(track.pan);
  const sendRev = new Tone.Gain(track.reverb).connect(fx.reverb);
  const sendDel = new Tone.Gain(track.delay).connect(fx.delay);
  const meter = new Tone.Meter();
  synth.chain(volume, panner, dest);
  panner.connect(sendRev);
  panner.connect(sendDel);
  panner.connect(meter);
  return { synth, volume, panner, sendRev, sendDel, meter };
}

const isAudible = (track, anySolo) => !track.muted && (!anySolo || track.solo);

export class Engine {
  constructor() {
    this.tracks = [];
    this.bpm = 120;
    this.steps = DEFAULT_STEPS;
    this.instruments = new Map(); // trackId -> {synth, volume}
    this.sequence = null;
    this.onStep = null;
    Tone.Transport.bpm.value = this.bpm;

    // All live tracks route through this shared bus so the analyser sees the mixed signal.
    this.masterDb = 0;
    this.swing = 0; // 0..1, delays every off-beat 16th
    this.master = new Tone.Gain(1);
    this.masterVol = new Tone.Volume(0);
    this.limiter = new Tone.Limiter(-1).toDestination(); // keeps loud mixes from clipping
    this.master.chain(this.masterVol, this.limiter);
    this.masterMeter = new Tone.Meter();
    this.masterVol.connect(this.masterMeter);
    this.analyser = new Tone.Waveform(1024);
    this.master.connect(this.analyser);
    this.fx = createFx(this.master);
  }

  setSwing(amount) {
    this.swing = amount;
    Tone.Transport.swing = amount;
    Tone.Transport.swingSubdivision = '16n';
  }

  // Shifts every note of a track by `semitones`.
  transposeTrack(trackId, semitones) {
    const track = this.tracks.find((t) => t.id === trackId);
    const remap = (map) =>
      new Map(
        [...map].map(([key, value]) => {
          const [step, midi] = key.split(':').map(Number);
          return [`${step}:${midi + semitones}`, value];
        })
      );
    track.cells = track.cells.map((set) => new Set([...set].map((m) => m + semitones)));
    track.lengths = remap(track.lengths);
    track.velocities = remap(track.velocities);
  }

  setMasterVolume(db) {
    this.masterDb = db;
    this.masterVol.volume.value = db;
  }

  // Current level of a track (or the master bus when trackId is omitted), in dB.
  getLevel(trackId) {
    const meter = trackId === undefined ? this.masterMeter : this.instruments.get(trackId)?.meter;
    return meter ? meter.getValue() : -Infinity;
  }

  // Returns the current waveform samples (Float32Array, values roughly -1..1).
  getWaveform() {
    return this.analyser.getValue();
  }

  addTrack(track) {
    this.tracks.push(track);
    this._buildInstrument(track);
  }

  removeTrack(trackId) {
    this.tracks = this.tracks.filter((t) => t.id !== trackId);
    this._disposeChannel(trackId);
    this.applyMix();
  }

  _disposeChannel(trackId) {
    const inst = this.instruments.get(trackId);
    if (!inst) return;
    Object.values(inst).forEach((node) => node.dispose());
    this.instruments.delete(trackId);
  }

  _buildInstrument(track) {
    this.instruments.set(track.id, createChannel(track, this.master, this.fx));
    this.applyMix();
  }

  // Swaps a track's synth voice (e.g. Sine Lead -> Bass). Rebuilds the instrument
  // since different presets use different Tone.js voice classes.
  setInstrument(trackId, instrumentKey) {
    const track = this.tracks.find((t) => t.id === trackId);
    track.instrument = instrumentKey;
    this._disposeChannel(trackId);
    this._buildInstrument(track);
  }

  // Pushes volume / mute / solo state to the channels (solo silences every non-soloed track).
  applyMix() {
    const anySolo = this.tracks.some((t) => t.solo);
    for (const track of this.tracks) {
      const inst = this.instruments.get(track.id);
      if (inst) inst.volume.volume.value = isAudible(track, anySolo) ? track.volume : -Infinity;
    }
  }

  setVolume(trackId, db) {
    this.tracks.find((t) => t.id === trackId).volume = db;
    this.applyMix();
  }

  setMuted(trackId, muted) {
    this.tracks.find((t) => t.id === trackId).muted = muted;
    this.applyMix();
  }

  setSolo(trackId, solo) {
    this.tracks.find((t) => t.id === trackId).solo = solo;
    this.applyMix();
  }

  setPan(trackId, pan) {
    this.tracks.find((t) => t.id === trackId).pan = pan;
    this.instruments.get(trackId).panner.pan.value = pan;
  }

  // bus: 'reverb' | 'delay', amount 0..1
  setSend(trackId, bus, amount) {
    this.tracks.find((t) => t.id === trackId)[bus] = amount;
    const inst = this.instruments.get(trackId);
    (bus === 'reverb' ? inst.sendRev : inst.sendDel).gain.value = amount;
  }

  setBpm(bpm) {
    this.bpm = bpm;
    Tone.Transport.bpm.value = bpm;
  }

  // Resizes every track to `newSteps` (truncating or padding with empty steps).
  // Use this to switch between a short repeating loop and a longer, non-looping track.
  setLength(newSteps) {
    this.steps = newSteps;
    for (const track of this.tracks) {
      track.cells = Array.from({ length: newSteps }, (_, i) => track.cells[i] || new Set());
    }
    // The built sequence's step count is fixed at build time; force a rebuild on next play().
    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
      this.sequence = null;
    }
  }

  toggleNote(trackId, step, midi) {
    const track = this.tracks.find((t) => t.id === trackId);
    const cell = track.cells[step];
    if (cell.has(midi)) {
      cell.delete(midi);
      track.lengths.delete(`${step}:${midi}`);
      track.velocities.delete(`${step}:${midi}`);
    } else cell.add(midi);
  }

  // Sets the velocity of every note at `step` (the velocity lane edits whole steps).
  setStepVelocity(trackId, step, v) {
    const track = this.tracks.find((t) => t.id === trackId);
    for (const midi of track.cells[step]) {
      if (v < 1) track.velocities.set(`${step}:${midi}`, v);
      else track.velocities.delete(`${step}:${midi}`);
    }
  }

  setNoteLength(trackId, step, midi, len) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (len > 1) track.lengths.set(`${step}:${midi}`, len);
    else track.lengths.delete(`${step}:${midi}`);
  }

  // Moves a note (keeping its length) to another step/pitch.
  moveNote(trackId, fromStep, fromMidi, toStep, toMidi) {
    const track = this.tracks.find((t) => t.id === trackId);
    const len = track.lengths.get(`${fromStep}:${fromMidi}`) || 1;
    const vel = track.velocities.get(`${fromStep}:${fromMidi}`);
    this.toggleNote(trackId, fromStep, fromMidi);
    track.cells[toStep].add(toMidi);
    this.setNoteLength(trackId, toStep, toMidi, len);
    if (vel !== undefined) track.velocities.set(`${toStep}:${toMidi}`, vel);
  }

  setRange(trackId, low, high) {
    const track = this.tracks.find((t) => t.id === trackId);
    track.rangeLow = Math.min(low, high);
    track.rangeHigh = Math.max(low, high);
  }

  // Rotates a track's notes by `delta` steps (wraps around the loop).
  shiftTrack(trackId, delta) {
    const track = this.tracks.find((t) => t.id === trackId);
    const n = track.cells.length;
    track.cells = track.cells.map((_, i) => track.cells[(((i - delta) % n) + n) % n]);
    const remap = (map) =>
      new Map(
        [...map].map(([key, value]) => {
          const [step, midi] = key.split(':').map(Number);
          return [`${(((step + delta) % n) + n) % n}:${midi}`, value];
        })
      );
    track.lengths = remap(track.lengths);
    track.velocities = remap(track.velocities);
  }

  clearTrack(trackId) {
    const track = this.tracks.find((t) => t.id === trackId);
    track.cells = Array.from({ length: this.steps }, () => new Set());
    track.lengths = new Map();
    track.velocities = new Map();
  }

  // Regenerates one track's note pattern using its own pitch range.
  randomizeTrack(trackId, { root = 0, scaleName = 'major', density = 0.4 } = {}) {
    const track = this.tracks.find((t) => t.id === trackId);
    track.lengths = new Map();
    track.velocities = new Map();
    track.cells = generatePattern({
      steps: this.steps,
      low: track.rangeLow,
      high: track.rangeHigh,
      root,
      scaleName,
      density,
    });
  }

  // Regenerates every track. Optionally randomizes instrument and/or tempo too.
  autoBuild({
    root = 0,
    scaleName = 'major',
    density = 0.4,
    randomizeInstruments = false,
    randomizeTempo = false,
    tempoMin = 80,
    tempoMax = 160,
  } = {}) {
    if (randomizeTempo) {
      const bpm = Math.round(tempoMin + Math.random() * (tempoMax - tempoMin));
      this.setBpm(bpm);
    }
    for (const track of this.tracks) {
      if (randomizeInstruments) {
        const key = INSTRUMENT_KEYS[Math.floor(Math.random() * INSTRUMENT_KEYS.length)];
        this.setInstrument(track.id, key);
      }
      this.randomizeTrack(track.id, { root, scaleName, density });
    }
  }

  _buildSequence() {
    if (this.sequence) {
      this.sequence.dispose();
      this.sequence = null;
    }
    const steps = Array.from({ length: this.steps }, (_, i) => i);
    this.sequence = new Tone.Sequence(
      (time, step) => {
        for (const track of this.tracks) {
          const inst = this.instruments.get(track.id);
          for (const midi of track.cells[step] || []) {
            const len = track.lengths.get(`${step}:${midi}`) || 1;
            const vel = track.velocities.get(`${step}:${midi}`) ?? 1;
            inst.synth.triggerAttackRelease(midiToNoteName(midi), (len * 60) / this.bpm / 4, time, vel);
          }
        }
        if (this.onStep) {
          Tone.Draw.schedule(() => this.onStep(step), time);
        }
      },
      steps,
      '16n'
    );
  }

  async play() {
    await Tone.start();
    // Resuming from pause: keep the existing sequence so playback continues
    // from where it left off instead of jumping back to step 0.
    if (!this.sequence) {
      this._buildSequence();
      this.sequence.start(0);
    }
    Tone.Transport.start();
  }

  // Halts playback but keeps the current position, so play() resumes from here.
  pause() {
    Tone.Transport.pause();
    // Cancel already-queued playhead redraws (Tone.Draw has lookahead) so the
    // playhead doesn't visually advance one extra step after pausing.
    Tone.Draw.cancel();
  }

  // Halts playback and resets position to the start.
  stop() {
    Tone.Transport.stop();
    Tone.Draw.cancel();
    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
      this.sequence = null;
    }
    if (this.onStep) this.onStep(-1);
  }

  isPlaying() {
    return Tone.Transport.state === 'started';
  }

  isPaused() {
    return Tone.Transport.state === 'paused';
  }

  // Renders the full pattern offline and returns an AudioBuffer.
  async renderOffline() {
    const stepDuration = 60 / this.bpm / 4; // 16th note duration in seconds
    const totalDuration = stepDuration * this.steps + 1; // +1s tail for release

    const buffer = await Tone.Offline(async ({ transport }) => {
      transport.bpm.value = this.bpm;
      transport.swing = this.swing;
      transport.swingSubdivision = '16n';
      const limiter = new Tone.Limiter(-1).toDestination();
      const out = new Tone.Volume(this.masterDb).connect(limiter);
      const fx = createFx(out);
      await fx.reverb.generate();
      const anySolo = this.tracks.some((t) => t.solo);
      const offlineInstruments = new Map();
      for (const track of this.tracks) {
        const ch = createChannel(track, out, fx);
        ch.volume.volume.value = isAudible(track, anySolo) ? track.volume : -Infinity;
        offlineInstruments.set(track.id, ch.synth);
      }
      const steps = Array.from({ length: this.steps }, (_, i) => i);
      const seq = new Tone.Sequence(
        (time, step) => {
          for (const track of this.tracks) {
            const synth = offlineInstruments.get(track.id);
            for (const midi of track.cells[step] || []) {
              const len = track.lengths.get(`${step}:${midi}`) || 1;
              const vel = track.velocities.get(`${step}:${midi}`) ?? 1;
              synth.triggerAttackRelease(midiToNoteName(midi), (len * 60) / this.bpm / 4, time, vel);
            }
          }
        },
        steps,
        '16n'
      );
      seq.start(0);
      transport.start();
    }, totalDuration);

    return buffer;
  }
}
