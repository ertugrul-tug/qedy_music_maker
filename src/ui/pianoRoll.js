import { GRID_HIGH as HIGH_MIDI, PITCH_COUNT, midiToNoteName } from '../audio/engine.js';

const BLACK_KEY_OFFSETS = new Set([1, 3, 6, 8, 10]);
const KEY_COLUMN = 56; // px, width of the sticky piano-key column (matches the CSS)

let cellWidth = 24; // px per step, changed by the zoom slider
let justResized = false; // swallows the click that follows a resize drag

function isBlackKey(midi) {
  return BLACK_KEY_OFFSETS.has(midi % 12);
}

export function setZoom(container, px) {
  cellWidth = px;
  container.style.setProperty('--cw', `${px}px`);
}

// Renders a piano-roll grid for a single track into `container`.
// The grid is built as one HTML string and driven by a few delegated listeners, because a long
// song has tens of thousands of cells; per-cell elements and listeners made every edit slow.
// Handlers: onToggle(step, midi, event), onMove(fromStep, fromMidi, toStep, toMidi),
// onResize(step, midi, len), onVelocity(step, v, first) (step === null ends a drag), onSeek(step).
export function renderPianoRoll(container, track, onToggle, _playingStep, onMove, onResize, onVelocity, onSeek) {
  const { scrollTop, scrollLeft } = container;
  const steps = track.cells.length;
  const velOf = (step, midi) => track.velocities.get(`${step}:${midi}`) ?? 1;
  const lenOf = (step, midi) => track.lengths.get(`${step}:${midi}`) || 1;

  // Cells covered by a long note's tail: "midi:step" -> owning step.
  const tails = new Map();
  track.cells.forEach((set, step) => {
    for (const midi of set) {
      const len = lenOf(step, midi);
      for (let k = 1; k < len && step + k < steps; k++) tails.set(`${midi}:${step + k}`, step);
    }
  });

  const stepClass = Array.from({ length: steps }, (_, s) => (s % 16 === 0 ? ' bar-start' : s % 4 === 0 ? ' beat-start' : ''));
  let html = '<div class="ruler-corner"></div>';
  for (let s = 0; s < steps; s++) {
    html += `<div class="ruler-cell${stepClass[s]}" data-step="${s}">${s % 16 === 0 ? s / 16 + 1 : ''}</div>`;
  }

  for (let row = 0; row < PITCH_COUNT; row++) {
    const midi = HIGH_MIDI - row;
    const outOfRange = midi < track.rangeLow || midi > track.rangeHigh ? ' out-of-range' : '';
    const black = isBlackKey(midi);
    html += `<div class="key-label${black ? ' black' : ''}${outOfRange}">${midiToNoteName(midi)}</div>`;
    const rowClass = (black ? ' black-row' : '') + outOfRange;
    for (let s = 0; s < steps; s++) {
      let cls = `cell${rowClass}${stepClass[s]}`;
      let attrs = `data-step="${s}" data-midi="${midi}"`;
      if (track.cells[s].has(midi)) {
        const len = lenOf(s, midi);
        cls += len === 1 ? ' active end' : ' active';
        // louder notes are brighter; the whole note can be dragged to move it
        attrs += ` data-owner="${s}" draggable="true" style="opacity:${0.4 + 0.6 * velOf(s, midi)}"`;
      } else {
        const owner = tails.get(`${midi}:${s}`);
        if (owner !== undefined) {
          cls += ' tail';
          if (s === owner + lenOf(owner, midi) - 1) cls += ' end';
          attrs += ` data-owner="${owner}"`;
        }
      }
      html += `<div class="${cls}" ${attrs}></div>`;
    }
  }

  // Velocity lane (sticky bottom row)
  html += '<div class="vel-label">VEL</div>';
  for (let s = 0; s < steps; s++) {
    const notes = [...track.cells[s]];
    const h = notes.length ? Math.max(...notes.map((m) => velOf(s, m))) * 100 : 0;
    html += `<div class="vel-cell${s % 16 === 0 ? ' bar-start' : ''}" data-vel-step="${s}"><i style="height:${h}%"></i></div>`;
  }
  html += '<div class="playhead"></div>';

  const grid = document.createElement('div');
  grid.className = 'piano-roll';
  grid.style.setProperty('--steps', steps);
  grid.style.setProperty('--pitches', PITCH_COUNT);
  grid.innerHTML = html;
  const bars = grid.querySelectorAll('.vel-cell i');

  grid.addEventListener('click', (e) => {
    const ruler = e.target.closest('.ruler-cell');
    if (ruler) return onSeek?.(Number(ruler.dataset.step));
    const cell = e.target.closest('.cell');
    if (cell && !justResized) onToggle(Number(cell.dataset.step), Number(cell.dataset.midi), e);
  });

  // Drag an existing note onto another cell to move it (time and/or pitch).
  grid.addEventListener('dragstart', (e) => {
    const cell = e.target.closest?.('.cell.active');
    if (cell) e.dataTransfer.setData('text/plain', `${cell.dataset.step}:${cell.dataset.midi}`);
  });
  grid.addEventListener('dragover', (e) => e.preventDefault());
  grid.addEventListener('drop', (e) => {
    e.preventDefault();
    const cell = e.target.closest('.cell');
    const [fs, fm] = e.dataTransfer.getData('text/plain').split(':').map(Number);
    if (cell && onMove && !Number.isNaN(fs)) onMove(fs, fm, Number(cell.dataset.step), Number(cell.dataset.midi));
  });

  grid.addEventListener('mousedown', (e) => {
    // Velocity lane: drag across steps to set the velocity of the notes at each step.
    const laneStart = e.target.closest('.vel-cell');
    if (laneStart && onVelocity) {
      e.preventDefault();
      let first = true;
      const apply = (ev) => {
        const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.vel-cell');
        if (!lane) return;
        const step = Number(lane.dataset.velStep);
        if (track.cells[step].size === 0) return;
        const r = lane.getBoundingClientRect();
        const v = Math.min(1, Math.max(0.05, 1 - (ev.clientY - r.top) / r.height));
        onVelocity(step, v, first);
        first = false;
        bars[step].style.height = `${v * 100}%`;
      };
      const up = () => {
        document.removeEventListener('mousemove', apply);
        document.removeEventListener('mouseup', up);
        if (!first) onVelocity(null, null, false); // re-render once so note brightness updates
      };
      apply(e);
      document.addEventListener('mousemove', apply);
      document.addEventListener('mouseup', up);
      return;
    }

    // Note edge: drag the right edge of a note to change its length.
    const cell = e.target.closest('.cell');
    if (!cell || cell.dataset.owner === undefined || !onResize) return;
    if (e.clientX < cell.getBoundingClientRect().right - 6) return;
    const owner = Number(cell.dataset.owner);
    const midi = Number(cell.dataset.midi);
    const len = lenOf(owner, midi);
    if (Number(cell.dataset.step) !== owner + len - 1) return;
    e.preventDefault();
    let newLen = len;
    const move = (ev) => {
      const s = document.elementFromPoint(ev.clientX, ev.clientY)?.dataset?.step;
      if (s !== undefined) newLen = Math.max(1, Number(s) - owner + 1);
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      justResized = true;
      setTimeout(() => (justResized = false));
      if (newLen !== len) onResize(owner, midi, newLen);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  container.replaceChildren(grid);
  container._playhead = grid.querySelector('.playhead');
  // Re-renders happen on every edit: keep the view where it was. First render: start around C5.
  if (container.dataset.scrolled) {
    container.scrollTop = scrollTop;
    container.scrollLeft = scrollLeft;
  } else {
    container.scrollTop = (HIGH_MIDI - 84) * 18;
    container.dataset.scrolled = '1';
  }
}

// Moves the playhead to a (fractional) step. With `follow`, scrolls so it stays centred in the view.
export function setPlayhead(container, step, follow) {
  const ph = container._playhead;
  if (!ph) return;
  const x = KEY_COLUMN + step * cellWidth;
  ph.style.display = 'block';
  ph.style.transform = `translateX(${x}px)`;
  if (follow) container.scrollLeft = x - container.clientWidth / 2 - KEY_COLUMN / 2;
}

export function hidePlayhead(container) {
  if (container._playhead) container._playhead.style.display = 'none';
}
