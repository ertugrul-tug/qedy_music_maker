import { LOW_MIDI, HIGH_MIDI, PITCH_COUNT, midiToNoteName } from '../audio/engine.js';

const BLACK_KEY_OFFSETS = new Set([1, 3, 6, 8, 10]);

function isBlackKey(midi) {
  return BLACK_KEY_OFFSETS.has(midi % 12);
}

// Renders a piano-roll grid for a single track into `container`.
// `track` is the data model; `onToggle(step, midi)` is called on cell click.
// Grid width is derived from track.cells.length, so loops and longer tracks both just work.
export function renderPianoRoll(container, track, onToggle, playingStep) {
  container.innerHTML = '';
  const steps = track.cells.length;
  const grid = document.createElement('div');
  grid.className = 'piano-roll';
  grid.style.setProperty('--steps', steps);
  grid.style.setProperty('--pitches', PITCH_COUNT);

  for (let row = 0; row < PITCH_COUNT; row++) {
    const midi = HIGH_MIDI - row;
    const outOfRange = midi < track.rangeLow || midi > track.rangeHigh;
    const keyLabel = document.createElement('div');
    keyLabel.className = 'key-label' + (isBlackKey(midi) ? ' black' : '') + (outOfRange ? ' out-of-range' : '');
    keyLabel.textContent = midiToNoteName(midi);
    keyLabel.style.gridRow = row + 1;
    keyLabel.style.gridColumn = 1;
    grid.appendChild(keyLabel);

    for (let step = 0; step < steps; step++) {
      const cell = document.createElement('div');
      cell.className = 'cell' + (isBlackKey(midi) ? ' black-row' : '') + (outOfRange ? ' out-of-range' : '');
      if (step % 16 === 0) cell.classList.add('bar-start');
      else if (step % 4 === 0) cell.classList.add('beat-start');
      if (track.cells[step].has(midi)) cell.classList.add('active');
      if (step === playingStep) cell.classList.add('playing');
      cell.style.gridRow = row + 1;
      cell.style.gridColumn = step + 2;
      cell.dataset.step = step;
      cell.addEventListener('click', () => onToggle(step, midi));
      grid.appendChild(cell);
    }
  }

  container.appendChild(grid);
}

export function updatePlayhead(container, playingStep) {
  const cells = container.querySelectorAll('.cell');
  cells.forEach((cell) => cell.classList.remove('playing'));
  if (playingStep < 0) return;
  container.querySelectorAll(`.cell[data-step="${playingStep}"]`).forEach((cell) => {
    cell.classList.add('playing');
  });
}
