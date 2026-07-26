import * as Tone from 'tone';
import { generatePattern } from './generator.js';
import { INSTRUMENTS, INSTRUMENT_KEYS, DEFAULT_INSTRUMENT } from './instruments.js';

export const DEFAULT_STEPS = 32; // 2 bars of 16th notes — a short loop
export const LOW_MIDI = 48; // C3
export const HIGH_MIDI = 83; // B5
export const PITCH_COUNT = HIGH_MIDI - LOW_MIDI + 1;

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
    // Pitch range used by the random generator (does not restrict manual editing)
    rangeLow: LOW_MIDI,
    rangeHigh: HIGH_MIDI,
    // cells[step] = Set of midi note numbers active at that step
    cells: Array.from({ length: steps }, () => new Set()),
  };
  return track;
}

function buildVoice(instrumentKey) {
  const preset = INSTRUMENTS[instrumentKey] || INSTRUMENTS[DEFAULT_INSTRUMENT];
  const SynthClass = SYNTH_CLASSES[preset.synth] || Tone.Synth;
  return new Tone.PolySynth(SynthClass, preset.options);
}

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
    this.master = new Tone.Gain(1).toDestination();
    this.analyser = new Tone.Waveform(1024);
    this.master.connect(this.analyser);
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
    const inst = this.instruments.get(trackId);
    if (inst) {
      inst.synth.dispose();
      inst.volume.dispose();
      this.instruments.delete(trackId);
    }
  }

  _buildInstrument(track) {
    const volume = new Tone.Volume(track.muted ? -Infinity : track.volume).connect(this.master);
    const synth = buildVoice(track.instrument).connect(volume);
    this.instruments.set(track.id, { synth, volume });
  }

  // Swaps a track's synth voice (e.g. Sine Lead -> Bass). Rebuilds the instrument
  // since different presets use different Tone.js voice classes.
  setInstrument(trackId, instrumentKey) {
    const track = this.tracks.find((t) => t.id === trackId);
    track.instrument = instrumentKey;
    const inst = this.instruments.get(trackId);
    if (inst) {
      inst.synth.dispose();
      inst.volume.dispose();
    }
    this._buildInstrument(track);
  }

  setVolume(trackId, db) {
    const track = this.tracks.find((t) => t.id === trackId);
    track.volume = db;
    const inst = this.instruments.get(trackId);
    if (!track.muted) inst.volume.volume.value = db;
  }

  setMuted(trackId, muted) {
    const track = this.tracks.find((t) => t.id === trackId);
    track.muted = muted;
    const inst = this.instruments.get(trackId);
    inst.volume.volume.value = muted ? -Infinity : track.volume;
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
    if (cell.has(midi)) cell.delete(midi);
    else cell.add(midi);
  }

  setRange(trackId, low, high) {
    const track = this.tracks.find((t) => t.id === trackId);
    track.rangeLow = Math.min(low, high);
    track.rangeHigh = Math.max(low, high);
  }

  clearTrack(trackId) {
    const track = this.tracks.find((t) => t.id === trackId);
    track.cells = Array.from({ length: this.steps }, () => new Set());
  }

  // Regenerates one track's note pattern using its own pitch range.
  randomizeTrack(trackId, { root = 0, scaleName = 'major', density = 0.4 } = {}) {
    const track = this.tracks.find((t) => t.id === trackId);
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
          const notes = track.cells[step];
          if (notes && notes.size > 0) {
            const noteNames = [...notes].map(midiToNoteName);
            inst.synth.triggerAttackRelease(noteNames, '16n', time);
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

    const buffer = await Tone.Offline(({ transport }) => {
      transport.bpm.value = this.bpm;
      const offlineInstruments = new Map();
      for (const track of this.tracks) {
        const volume = new Tone.Volume(track.muted ? -Infinity : track.volume).toDestination();
        const synth = buildVoice(track.instrument).connect(volume);
        offlineInstruments.set(track.id, synth);
      }
      const steps = Array.from({ length: this.steps }, (_, i) => i);
      const seq = new Tone.Sequence(
        (time, step) => {
          for (const track of this.tracks) {
            const synth = offlineInstruments.get(track.id);
            const notes = track.cells[step];
            if (notes && notes.size > 0) {
              const noteNames = [...notes].map(midiToNoteName);
              synth.triggerAttackRelease(noteNames, '16n', time);
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
