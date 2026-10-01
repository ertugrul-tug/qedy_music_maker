// Instrument presets. `synth` names a Tone.js voice class (see SYNTH_CLASSES in engine.js);
// all of them are compatible with Tone.PolySynth so chords work on every preset.
export const INSTRUMENTS = {
  sineLead: {
    label: 'Sine Lead',
    synth: 'Synth',
    options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.3 },
    },
  },
  squareLead: {
    label: 'Square Lead',
    synth: 'Synth',
    options: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.3 },
    },
  },
  sawLead: {
    label: 'Saw Lead',
    synth: 'Synth',
    options: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.3 },
    },
  },
  trianglePad: {
    label: 'Triangle Pad',
    synth: 'Synth',
    options: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.08, decay: 0.3, sustain: 0.5, release: 0.8 },
    },
  },
  bass: {
    label: 'Bass',
    synth: 'MonoSynth',
    options: {
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', Q: 2, rolloff: -24 },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.4 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.6, baseFrequency: 80, octaves: 3 },
    },
  },
  subBass: {
    label: 'Sub Bass',
    synth: 'MonoSynth',
    options: {
      oscillator: { type: 'sine' },
      filter: { type: 'lowpass', Q: 1, rolloff: -24 },
      envelope: { attack: 0.02, decay: 0.4, sustain: 0.6, release: 0.5 },
      filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.5, baseFrequency: 60, octaves: 2 },
    },
  },
  fmBell: {
    label: 'FM Bell',
    synth: 'FMSynth',
    options: {
      harmonicity: 3,
      modulationIndex: 10,
      envelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 1.2 },
      modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.5 },
    },
  },
  bossHit: {
    label: 'Boss Hit (Kick)',
    synth: 'MembraneSynth',
    options: {
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.2 },
    },
  },
  metalPercussion: {
    label: 'Metal Percussion',
    synth: 'MetalSynth',
    options: {
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      envelope: { attack: 0.001, decay: 0.3, release: 0.2 },
    },
  },
};

export const INSTRUMENT_KEYS = Object.keys(INSTRUMENTS);

export const DEFAULT_INSTRUMENT = 'sineLead';

// Backward-compat: old .qedy files stored a raw oscillator "waveform" instead of an instrument key.
export const LEGACY_WAVEFORM_TO_INSTRUMENT = {
  sine: 'sineLead',
  square: 'squareLead',
  sawtooth: 'sawLead',
  triangle: 'trianglePad',
};

// Orchestral-style presets for the live keyboard (synth approximations, no samples).
Object.assign(INSTRUMENTS, {
  strings: {
    label: 'Orchestra Strings',
    synth: 'Synth',
    options: {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 25 },
      envelope: { attack: 0.35, decay: 0.3, sustain: 0.8, release: 1.6 },
    },
  },
  brass: {
    label: 'Orchestra Brass',
    synth: 'Synth',
    options: {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 12 },
      envelope: { attack: 0.08, decay: 0.2, sustain: 0.7, release: 0.5 },
    },
  },
  choir: {
    label: 'Choir Pad',
    synth: 'AMSynth',
    options: {
      harmonicity: 1.5,
      envelope: { attack: 0.5, decay: 0.3, sustain: 0.9, release: 2 },
      modulationEnvelope: { attack: 0.6, decay: 0.2, sustain: 0.8, release: 1.5 },
    },
  },
});
Object.assign(INSTRUMENTS, {
  kick: {
    label: 'Drum Kick',
    synth: 'MembraneSynth',
    options: { pitchDecay: 0.04, octaves: 5, envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.5 } },
  },
  snareDrum: {
    label: 'Drum Snare',
    synth: 'MembraneSynth',
    options: { pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.1 } },
  },
  hat: {
    label: 'Drum Hat',
    synth: 'MetalSynth',
    options: {
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 7000,
      octaves: 1.5,
      envelope: { attack: 0.001, decay: 0.06, release: 0.02 },
    },
  },
});
INSTRUMENT_KEYS.push('strings', 'brass', 'choir', 'kick', 'snareDrum', 'hat');
