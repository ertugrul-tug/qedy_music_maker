export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const ROOT_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'];

export function scaleNotesInRange(root, scaleName, low, high) {
  const intervals = SCALES[scaleName] || SCALES.major;
  const notes = [];
  for (let midi = low; midi <= high; midi++) {
    const pitchClass = ((midi - root) % 12 + 12) % 12;
    if (intervals.includes(pitchClass)) notes.push(midi);
  }
  return notes;
}

// Generates a randomized, scale-constrained note pattern.
// density: 0-1, fraction of steps that get a note.
export function generatePattern({ steps, low, high, root = 0, scaleName = 'major', density = 0.4 }) {
  const cells = Array.from({ length: steps }, () => new Set());
  const pool = scaleNotesInRange(root, scaleName, low, high);
  if (pool.length === 0) return cells;

  for (let step = 0; step < steps; step++) {
    if (Math.random() < density) {
      const note = pool[Math.floor(Math.random() * pool.length)];
      cells[step].add(note);
      if (Math.random() < 0.15 && pool.length > 1) {
        let harmony = pool[Math.floor(Math.random() * pool.length)];
        if (harmony !== note) cells[step].add(harmony);
      }
    }
  }
  return cells;
}

export function randomWaveform() {
  return WAVEFORMS[Math.floor(Math.random() * WAVEFORMS.length)];
}

export function randomTempo(min = 80, max = 160) {
  return Math.round(min + Math.random() * (max - min));
}
