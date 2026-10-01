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

// ---- Sampled (real recorded) instruments ----
// Loaded on demand from public CDNs when a track or the live keyboard uses them (CC-BY 3.0:
// Salamander Grand Piano by Alexander Holm, other instruments from nbrosowsky/tonejs-instruments).
const TONEJS = 'https://nbrosowsky.github.io/tonejs-instruments/samples/';
const SALAMANDER = 'https://tonejs.github.io/audio/salamander/';

// Sample files are named like "As3.mp3" for A#3; a Tone.Sampler pitches the nearest sample to any note.
function sampled(label, baseUrl, notes, release = 1) {
  const urls = Object.fromEntries(notes.split(' ').map((n) => [n, `${n.replace('#', 's')}.mp3`]));
  return { label: `${label} (sampled)`, sampler: { baseUrl, urls, release } };
}

Object.assign(INSTRUMENTS, {
  sPiano: sampled('Grand Piano', SALAMANDER, 'A0 C1 D#1 F#1 A1 C2 D#2 F#2 A2 C3 D#3 F#3 A3 C4 D#4 F#4 A4 C5 D#5 F#5 A5 C6 D#6 F#6 A6 C7', 1),
  sViolin: sampled('Violin', `${TONEJS}violin/`, 'G3 A3 C4 E4 G4 A4 C5 E5 G5 A5 C6 E6 G6 A6 C7'),
  sCello: sampled('Cello', `${TONEJS}cello/`, 'C2 D#2 A2 C3 D#3 F#3 A3 C4 D#4 F#4 A4 C5'),
  sContrabass: sampled('Contrabass', `${TONEJS}contrabass/`, 'G1 C2 E2 A2 C#3 E3'),
  sFlute: sampled('Flute', `${TONEJS}flute/`, 'C4 E4 A4 C5 E5 A5 C6 E6 A6 C7'),
  sClarinet: sampled('Clarinet', `${TONEJS}clarinet/`, 'D3 F3 A#3 D4 F4 A#4 D5 F5 A#5 D6 F#6'),
  sBassoon: sampled('Bassoon', `${TONEJS}bassoon/`, 'G2 A2 C3 G3 A3 C4 E4 G4 A4 C5'),
  sFrenchHorn: sampled('French Horn', `${TONEJS}french-horn/`, 'A1 C2 D#2 G2 D3 F3 A3 C4 D5 F5'),
  sTrumpet: sampled('Trumpet', `${TONEJS}trumpet/`, 'F3 A3 C4 D#4 F4 G4 A#4 D5 F5 A5 C6'),
  sTrombone: sampled('Trombone', `${TONEJS}trombone/`, 'A#1 C#2 F2 A#2 D3 F3 A#3 D4'),
  sTuba: sampled('Tuba', `${TONEJS}tuba/`, 'F1 A#1 D#2 F2 A#2 D3 F3 A#3 D4'),
  sHarp: sampled('Harp', `${TONEJS}harp/`, 'E1 B1 D2 A2 C3 G3 D4 A4 C5 G5 D6 A6', 2),
  sOrgan: sampled('Organ', `${TONEJS}organ/`, 'A1 C2 F#2 C3 D#3 A3 C4 F#4 C5 A5 C6', 0.3),
  sXylophone: sampled('Xylophone', `${TONEJS}xylophone/`, 'G4 C5 G5 C6 G6 C7 G7 C8', 0.5),
  sGuitarNylon: sampled('Nylon Guitar', `${TONEJS}guitar-nylon/`, 'B1 E2 A2 D3 G3 B3 E4 A4 D5 F#5'),
  sGuitarAcoustic: sampled('Acoustic Guitar', `${TONEJS}guitar-acoustic/`, 'E2 A2 D3 G3 B3 E4 A4 D5'),
  sGuitarElectric: sampled('Electric Guitar', `${TONEJS}guitar-electric/`, 'E2 A2 C3 F#3 C4 F#4 C5 F#5 C6'),
  sBassElectric: sampled('Electric Bass', `${TONEJS}bass-electric/`, 'E1 A#1 E2 A#2 E3 A#3 E4', 0.5),
  sSax: sampled('Saxophone', `${TONEJS}saxophone/`, 'C#3 E3 G3 A#3 C#4 E4 G4 A#4 C#5 E5 G5'),
  // Layered sections: several sampled instruments played together.
  sStrings: { label: 'String Section (sampled)', layers: ['sViolin', 'sCello', 'sContrabass'] },
  sBrass: { label: 'Brass Section (sampled)', layers: ['sTrumpet', 'sTrombone', 'sFrenchHorn', 'sTuba'] },
  sOrchestra: { label: 'Full Orchestra (sampled)', layers: ['sViolin', 'sCello', 'sFrenchHorn', 'sFlute'] },
});

INSTRUMENT_KEYS.push(
  'strings', 'brass', 'choir', 'kick', 'snareDrum', 'hat',
  'sPiano', 'sViolin', 'sCello', 'sContrabass', 'sFlute', 'sClarinet', 'sBassoon', 'sFrenchHorn', 'sTrumpet',
  'sTrombone', 'sTuba', 'sHarp', 'sOrgan', 'sXylophone', 'sGuitarNylon', 'sGuitarAcoustic', 'sGuitarElectric',
  'sBassElectric', 'sSax', 'sStrings', 'sBrass', 'sOrchestra'
);

// Instruments that need no network: used by Auto Build's random instrument pick.
export const SYNTH_KEYS = INSTRUMENT_KEYS.filter((k) => !INSTRUMENTS[k].sampler && !INSTRUMENTS[k].layers);
