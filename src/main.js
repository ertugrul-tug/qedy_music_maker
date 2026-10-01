import './style.css';
import { Engine, createTrack, GRID_LOW as LOW_MIDI, GRID_HIGH as HIGH_MIDI, midiToNoteName } from './audio/engine.js';
import { INSTRUMENTS, INSTRUMENT_KEYS } from './audio/instruments.js';
import { renderPianoRoll, updatePlayhead } from './ui/pianoRoll.js';
import { startOscilloscopeLoop } from './ui/oscilloscope.js';
import { audioBufferToWav, transcodeWav, downloadBlob } from './audio/export.js';
import { ROOT_NAMES } from './audio/generator.js';
import { saveProject, parseProjectFile, applyProjectToEngine } from './audio/project.js';
import { DEMOS } from './audio/demoLibrary.js';
import * as Tone from 'tone';
import { createLive, RHYTHMS } from './audio/live.js';

const engine = new Engine();
let activeTrackId = null;

const trackTabsEl = document.getElementById('track-tabs');
const trackControlsEl = document.getElementById('track-controls');
const pianoRollEl = document.getElementById('piano-roll-container');
const statusEl = document.getElementById('status');
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const bpmInput = document.getElementById('bpm-input');
const abRootSelect = document.getElementById('ab-root');
const abScaleSelect = document.getElementById('ab-scale');
const abDensityInput = document.getElementById('ab-density');
const abInstrumentsCheckbox = document.getElementById('ab-instruments');
const abTempoCheckbox = document.getElementById('ab-tempo');
const projectNameInput = document.getElementById('project-name-input');
const lengthSelect = document.getElementById('length-select');
const scopeCanvas = document.getElementById('oscilloscope');
const demoSelect = document.getElementById('demo-select');
const demoDescriptionEl = document.getElementById('demo-description');

const mobileTabButtons = document.querySelectorAll('.mobile-tab-btn');
const mobileTabTargets = {
  tracks: document.querySelector('.tracks-sidebar'),
  controls: document.querySelector('.controls-sidebar'),
  editor: document.querySelector('.main-column'),
};
function setMobileTab(tab) {
  mobileTabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  Object.entries(mobileTabTargets).forEach(([key, el]) => el.classList.toggle('active-tab', key === tab));
}
mobileTabButtons.forEach((btn) => btn.addEventListener('click', () => setMobileTab(btn.dataset.tab)));
setMobileTab('editor');

ROOT_NAMES.forEach((name, i) => {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = name;
  abRootSelect.appendChild(opt);
});

const demoGroups = [
  { category: 'original', length: 'loop', label: 'Original Loops' },
  { category: 'original', length: 'track', label: 'Original Tracks (Longer)' },
  { category: 'original', length: 'epic', label: 'Original Epics (~1 minute)' },
  { category: 'public-domain', length: 'loop', label: 'Public Domain Loops' },
  { category: 'public-domain', length: 'track', label: 'Public Domain Tracks (Longer)' },
  { category: 'public-domain', length: 'epic', label: 'Public Domain Epics (~1 minute)' },
];
demoGroups.forEach(({ category, length, label }) => {
  const matches = DEMOS.filter((d) => d.category === category && d.length === length);
  if (matches.length === 0) return;
  const group = document.createElement('optgroup');
  group.label = label;
  matches.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.label;
    group.appendChild(opt);
  });
  demoSelect.appendChild(group);
});

function updateDemoDescription() {
  const demo = DEMOS.find((d) => d.id === demoSelect.value);
  if (!demo) {
    demoDescriptionEl.textContent = '';
    return;
  }
  const bars = demo.data.steps / 16;
  demoDescriptionEl.textContent = `${demo.description} (${bars} bars, ${demo.length})`;
}
demoSelect.addEventListener('change', updateDemoDescription);
updateDemoDescription();

startOscilloscopeLoop(scopeCanvas, () => engine.getWaveform());

function setStatus(text) {
  statusEl.textContent = text;
}

function getActiveTrack() {
  return engine.tracks.find((t) => t.id === activeTrackId);
}

function addTrack() {
  const track = createTrack(undefined, engine.steps);
  engine.addTrack(track);
  activeTrackId = track.id;
  renderAll();
}

function syncLengthSelect() {
  const value = String(engine.steps);
  const hasOption = [...lengthSelect.options].some((o) => o.value === value);
  if (!hasOption) {
    document.querySelectorAll('option.custom-length').forEach((o) => o.remove());
    const opt = document.createElement('option');
    opt.className = 'custom-length';
    opt.value = value;
    opt.textContent = `${engine.steps} steps (custom)`;
    lengthSelect.appendChild(opt);
  }
  lengthSelect.value = value;
}

lengthSelect.addEventListener('change', () => {
  clearHistory();
  engine.stop();
  engine.setLength(Number(lengthSelect.value));
  renderAll();
  setStatus(`Length set to ${engine.steps} steps`);
});

function renderTabs() {
  trackTabsEl.innerHTML = '';
  engine.tracks.forEach((track) => {
    const tab = document.createElement('div');
    tab.className = 'track-tab' + (track.id === activeTrackId ? ' active' : '');
    const name = document.createElement('span');
    name.className = 'track-tab-name';
    name.textContent = track.name;
    tab.append(name, muteSoloButtons(track));
    tab.addEventListener('click', () => {
      activeTrackId = track.id;
      renderAll();
    });
    trackTabsEl.appendChild(tab);
  });
}

// Small M / S buttons shared by the track list and the mixer strips.
function muteSoloButtons(track) {
  const wrap = document.createElement('span');
  wrap.className = 'ms-btns';
  [['M', 'muted', 'Mute', (v) => engine.setMuted(track.id, v)], ['S', 'solo', 'Solo', (v) => engine.setSolo(track.id, v)]].forEach(
    ([label, key, title, apply]) => {
      const b = document.createElement('button');
      b.className = `ms ms-${key}` + (track[key] ? ' on' : '');
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        apply(!track[key]);
        refreshMix();
      });
      wrap.appendChild(b);
    }
  );
  return wrap;
}

function refreshMix() {
  renderTabs();
  renderControls();
  renderMixer();
}

function renderControls() {
  trackControlsEl.innerHTML = '';
  const track = getActiveTrack();
  if (!track) return;

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'track-name-input';
  nameInput.value = track.name;
  nameInput.addEventListener('change', () => {
    track.name = nameInput.value || track.name;
    renderTabs();
  });

  const instrumentSelect = document.createElement('select');
  INSTRUMENT_KEYS.forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = INSTRUMENTS[key].label;
    if (key === track.instrument) opt.selected = true;
    instrumentSelect.appendChild(opt);
  });
  instrumentSelect.addEventListener('change', () => {
    engine.setInstrument(track.id, instrumentSelect.value);
  });

  const volLabel = document.createElement('label');
  volLabel.className = 'vol-label';
  volLabel.textContent = 'Vol';
  const volInput = document.createElement('input');
  volInput.type = 'range';
  volInput.min = '-40';
  volInput.max = '6';
  volInput.value = String(track.volume);
  volInput.addEventListener('input', () => {
    engine.setVolume(track.id, Number(volInput.value));
  });
  volLabel.appendChild(volInput);

  const muteBtn = document.createElement('button');
  muteBtn.className = 'btn small' + (track.muted ? ' active' : '');
  muteBtn.textContent = track.muted ? 'Muted' : 'Mute';
  muteBtn.addEventListener('click', () => {
    engine.setMuted(track.id, !track.muted);
    refreshMix();
  });

  const rangeLabel = document.createElement('label');
  rangeLabel.className = 'range-label';
  rangeLabel.textContent = 'Range';
  const lowSelect = document.createElement('select');
  const highSelect = document.createElement('select');
  for (let midi = LOW_MIDI; midi <= HIGH_MIDI; midi++) {
    const lowOpt = document.createElement('option');
    lowOpt.value = String(midi);
    lowOpt.textContent = midiToNoteName(midi);
    if (midi === track.rangeLow) lowOpt.selected = true;
    lowSelect.appendChild(lowOpt);

    const highOpt = document.createElement('option');
    highOpt.value = String(midi);
    highOpt.textContent = midiToNoteName(midi);
    if (midi === track.rangeHigh) highOpt.selected = true;
    highSelect.appendChild(highOpt);
  }
  const applyRange = () => {
    engine.setRange(track.id, Number(lowSelect.value), Number(highSelect.value));
    renderGrid();
  };
  lowSelect.addEventListener('change', applyRange);
  highSelect.addEventListener('change', applyRange);
  rangeLabel.append(lowSelect, document.createTextNode('–'), highSelect);

  const randomizeBtn = document.createElement('button');
  randomizeBtn.className = 'btn small';
  randomizeBtn.textContent = '🎲 Randomize';
  randomizeBtn.addEventListener('click', () => {
    pushUndo();
    engine.randomizeTrack(track.id, {
      root: Number(abRootSelect.value),
      scaleName: abScaleSelect.value,
      density: Number(abDensityInput.value),
    });
    renderGrid();
  });

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn small';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    pushUndo();
    engine.clearTrack(track.id);
    renderGrid();
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn small danger';
  removeBtn.textContent = 'Remove Track';
  removeBtn.addEventListener('click', () => {
    if (engine.tracks.length <= 1) return;
    clearHistory();
    engine.removeTrack(track.id);
    activeTrackId = engine.tracks[0].id;
    renderAll();
  });

  const shiftBtns = [['⏮', -16, 'Move 1 bar earlier'], ['◀', -1, 'Move 1 step earlier'], ['▶', 1, 'Move 1 step later'], ['⏭', 16, 'Move 1 bar later']].map(
    ([label, delta, title]) => {
      const b = document.createElement('button');
      b.className = 'btn small';
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', () => {
        pushUndo();
        engine.shiftTrack(track.id, delta);
        renderGrid();
      });
      return b;
    }
  );

  trackControlsEl.append(
    nameInput,
    instrumentSelect,
    volLabel,
    rangeLabel,
    muteBtn,
    ...shiftBtns,
    randomizeBtn,
    clearBtn,
    removeBtn
  );
}

function renderGrid() {
  const track = getActiveTrack();
  if (!track) return;
  renderPianoRoll(pianoRollEl, track, (step, midi, e) => {
    pushUndo();
    if (e?.shiftKey && track.cells[step].has(midi)) {
      // Shift+click cycles the note length: 1 -> 2 -> 4 -> 8 -> 16 steps -> 1
      const len = track.lengths.get(`${step}:${midi}`) || 1;
      engine.setNoteLength(track.id, step, midi, len >= 16 ? 1 : len * 2);
    } else {
      engine.toggleNote(track.id, step, midi);
    }
    renderGrid();
  }, -1, (fs, fm, ts, tm) => {
    pushUndo();
    engine.moveNote(track.id, fs, fm, ts, tm);
    renderGrid();
  }, (step, midi, len) => {
    pushUndo();
    engine.setNoteLength(track.id, step, midi, len);
    renderGrid();
  });
}

function renderAll() {
  renderTabs();
  renderControls();
  renderGrid();
  renderMixer();
}

// ---- Mixer ----
const mixerEl = document.getElementById('mixer');
let view = 'roll';

function slider(min, max, step, value, onInput, resetTo, cls = '') {
  const el = document.createElement('input');
  el.type = 'range';
  el.min = min;
  el.max = max;
  el.step = step;
  el.value = value;
  el.className = cls;
  el.addEventListener('input', () => onInput(Number(el.value)));
  if (resetTo !== undefined) {
    el.addEventListener('dblclick', () => {
      el.value = resetTo;
      onInput(resetTo);
    });
  }
  return el;
}

function labeled(text, control) {
  const wrap = document.createElement('label');
  wrap.className = 'mx-row';
  const span = document.createElement('span');
  span.textContent = text;
  wrap.append(span, control);
  return wrap;
}

function meterEl(id) {
  const m = document.createElement('div');
  m.className = 'meter';
  m.dataset.level = id === undefined ? 'master' : id;
  m.innerHTML = '<i></i>';
  return m;
}

function renderMixer() {
  mixerEl.innerHTML = '';
  engine.tracks.forEach((track) => {
    const strip = document.createElement('div');
    strip.className = 'strip' + (track.id === activeTrackId ? ' active' : '');
    const name = document.createElement('div');
    name.className = 'strip-name';
    name.textContent = track.name;
    name.title = INSTRUMENTS[track.instrument]?.label || '';
    name.addEventListener('click', () => {
      activeTrackId = track.id;
      renderAll();
    });
    const fader = document.createElement('div');
    fader.className = 'fader-wrap';
    fader.append(
      slider(-40, 6, 1, track.volume, (v) => engine.setVolume(track.id, v), -6, 'fader'),
      meterEl(track.id)
    );
    strip.append(
      name,
      labeled('PAN', slider(-1, 1, 0.01, track.pan, (v) => engine.setPan(track.id, v), 0)),
      labeled('REV', slider(0, 1, 0.01, track.reverb, (v) => engine.setSend(track.id, 'reverb', v), 0)),
      labeled('DLY', slider(0, 1, 0.01, track.delay, (v) => engine.setSend(track.id, 'delay', v), 0)),
      muteSoloButtons(track),
      fader
    );
    mixerEl.appendChild(strip);
  });

  const master = document.createElement('div');
  master.className = 'strip master';
  const fader = document.createElement('div');
  fader.className = 'fader-wrap';
  fader.append(slider(-40, 6, 1, engine.masterDb, (v) => engine.setMasterVolume(v), 0, 'fader'), meterEl());
  const label = document.createElement('div');
  label.className = 'strip-name';
  label.textContent = 'MASTER';
  master.append(label, fader);
  mixerEl.appendChild(master);
}

function setView(next) {
  view = next;
  document.querySelectorAll('.view-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === next));
  trackControlsEl.hidden = next !== 'roll';
  pianoRollEl.hidden = next !== 'roll';
  mixerEl.hidden = next !== 'mixer';
}
document.querySelectorAll('.view-tab').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

// Level meters: only polled while the mixer is on screen.
const toFill = (db) => Math.max(0, Math.min(1, (db + 60) / 66));
(function meterLoop() {
  if (view === 'mixer') {
    mixerEl.querySelectorAll('.meter').forEach((m) => {
      const id = m.dataset.level;
      const db = engine.getLevel(id === 'master' ? undefined : Number(id));
      m.firstChild.style.height = `${toFill(db) * 100}%`;
    });
  }
  requestAnimationFrame(meterLoop);
})();

// ---- Undo / redo (note data only: cells and lengths) ----
const undoStack = [];
const redoStack = [];
const snapshot = () =>
  engine.tracks.map((t) => ({ id: t.id, cells: t.cells.map((c) => new Set(c)), lengths: new Map(t.lengths) }));
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}
function clearHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
}
function restore(snap) {
  for (const s of snap) {
    const t = engine.tracks.find((x) => x.id === s.id);
    if (t) {
      t.cells = s.cells;
      t.lengths = s.lengths;
    }
  }
  renderGrid();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
}
document.getElementById('undo-btn').addEventListener('click', undo);
document.getElementById('redo-btn').addEventListener('click', redo);
window.addEventListener('keydown', (e) => {
  const t = e.target.tagName;
  if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || t === 'BUTTON') return;
  if (e.ctrlKey || e.metaKey) {
    if (e.code === 'KeyZ') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (e.code === 'KeyY') {
      e.preventDefault();
      redo();
    }
  } else if (e.code === 'Enter') {
    engine.isPlaying() ? stopBtn.click() : playBtn.click();
  }
});

playBtn.addEventListener('click', async () => {
  setStatus(engine.isPaused() ? 'Resuming…' : 'Playing…');
  engine.onStep = (step) => updatePlayhead(pianoRollEl, step);
  await engine.play();
  setStatus('Playing…');
});

pauseBtn.addEventListener('click', () => {
  if (!engine.isPlaying()) return;
  engine.pause();
  setStatus('Paused');
});

stopBtn.addEventListener('click', () => {
  engine.stop();
  setStatus('');
});

bpmInput.addEventListener('change', () => {
  const bpm = Number(bpmInput.value) || 120;
  engine.setBpm(bpm);
});

document.getElementById('add-track').addEventListener('click', addTrack);

document.getElementById('auto-build-btn').addEventListener('click', () => {
  pushUndo();
  engine.autoBuild({
    root: Number(abRootSelect.value),
    scaleName: abScaleSelect.value,
    density: Number(abDensityInput.value),
    randomizeInstruments: abInstrumentsCheckbox.checked,
    randomizeTempo: abTempoCheckbox.checked,
  });
  bpmInput.value = String(engine.bpm);
  renderAll();
  setStatus('Auto-built new loop');
});

async function handleExport(format) {
  setStatus(`Rendering audio…`);
  try {
    const buffer = await engine.renderOffline();
    const wavBlob = audioBufferToWav(buffer);

    if (format === 'wav') {
      downloadBlob(wavBlob, 'qedy-music.wav');
      setStatus('Exported WAV');
      return;
    }

    setStatus(`Encoding ${format.toUpperCase()}… (first export loads the encoder, may take a moment)`);
    const encodedBlob = await transcodeWav(wavBlob, format, (msg) => {
      // ffmpeg log output; keep status simple for the user
    });
    downloadBlob(encodedBlob, `qedy-music.${format}`);
    setStatus(`Exported ${format.toUpperCase()}`);
  } catch (err) {
    console.error(err);
    setStatus(`Export failed: ${err.message}`);
  }
}

document.getElementById('export-wav').addEventListener('click', () => handleExport('wav'));
document.getElementById('export-mp3').addEventListener('click', () => handleExport('mp3'));
document.getElementById('export-ogg').addEventListener('click', () => handleExport('ogg'));

document.getElementById('save-project').addEventListener('click', () => {
  saveProject(engine, projectNameInput.value);
  setStatus('Project saved');
});

const loadInput = document.getElementById('load-project-input');
document.getElementById('load-project').addEventListener('click', () => loadInput.click());
loadInput.addEventListener('change', async () => {
  const file = loadInput.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = parseProjectFile(text);
    clearHistory();
    engine.stop();
    const firstId = applyProjectToEngine(engine, data, createTrack);
    activeTrackId = firstId;
    bpmInput.value = String(engine.bpm);
    projectNameInput.value = data.name || file.name.replace(/\.qedy$/i, '');
    syncLengthSelect();
    renderAll();
    setStatus(`Loaded ${file.name}`);
  } catch (err) {
    console.error(err);
    setStatus(`Load failed: ${err.message}`);
  } finally {
    loadInput.value = '';
  }
});

document.getElementById('load-demo-btn').addEventListener('click', () => {
  const demo = DEMOS.find((d) => d.id === demoSelect.value);
  if (!demo) return;
  clearHistory();
  engine.stop();
  const firstId = applyProjectToEngine(engine, demo.data, createTrack);
  activeTrackId = firstId;
  bpmInput.value = String(engine.bpm);
  projectNameInput.value = demo.label;
  syncLengthSelect();
  renderAll();
  setStatus(`Loaded demo: ${demo.label}`);
});

// ---- Live keyboard ----
const live = createLive(engine);
const liveKeysEl = document.getElementById('live-keys');
const liveInstrument = document.getElementById('live-instrument');
const liveRoot = document.getElementById('live-root');
const liveScale = document.getElementById('live-scale');
const liveRhythm = document.getElementById('live-rhythm');
const liveDrums = document.getElementById('live-drums');

INSTRUMENT_KEYS.forEach((k) => liveInstrument.add(new Option(INSTRUMENTS[k].label, k)));
liveInstrument.value = 'strings';
ROOT_NAMES.forEach((n, i) => liveRoot.add(new Option(n, String(i))));
Object.entries(RHYTHMS).forEach(([k, r]) => liveRhythm.add(new Option(r.label, k)));

const KEY_LABELS = { Semicolon: 'Ş', Quote: 'İ' };
function renderLiveKeys() {
  const held = live.heldMidis();
  const whites = live.keyLabels();
  const makeKey = (code, midi, cls) => {
    const el = document.createElement('div');
    el.className = 'live-key' + cls + (held.has(midi) ? ' down' : '');
    el.innerHTML = `${KEY_LABELS[code] || code.slice(3)}<small>${midiToNoteName(midi)}</small>`;
    return el;
  };
  liveKeysEl.innerHTML = '';
  whites.forEach(({ code, midi }) => liveKeysEl.appendChild(makeKey(code, midi, '')));
  live.blackKeys().forEach(({ code, midi, after }) => {
    const el = makeKey(code, midi, ' black');
    el.style.left = `${((after + 1) / whites.length) * 100}%`;
    liveKeysEl.appendChild(el);
  });
  liveKeysEl.classList.toggle('pedal', live.isPedal());
  document.getElementById('live-octave').textContent = 'OCT ' + live.state.octave;
}
live.onChange = renderLiveKeys;
// Blur selects after use so keyboard playing (and Space) isn't swallowed by a focused dropdown.
[liveInstrument, liveRoot, liveScale, liveRhythm].forEach((el) => el.addEventListener('change', () => el.blur()));
liveInstrument.addEventListener('change', () => live.setInstrument(liveInstrument.value));
liveRoot.addEventListener('change', () => { live.state.root = Number(liveRoot.value); renderLiveKeys(); });
liveScale.addEventListener('change', () => { live.state.scale = liveScale.value; renderLiveKeys(); });
liveRhythm.addEventListener('change', () => live.setRhythm(liveRhythm.value));
liveDrums.addEventListener('click', async () => {
  if (live.isDrumming()) live.stopDrums();
  else await live.startDrums();
  liveDrums.textContent = live.isDrumming() ? '■ Drums' : '▶ Drums';
  liveDrums.blur();
});
renderLiveKeys();

// ---- Recording / key-loop ----
const recBtn = document.getElementById('rec-btn');
const recUndo = document.getElementById('rec-undo');
const recQuant = document.getElementById('rec-quant');
let recording = null; // { track, snapshot, lengths }
let counting = false;
const openNotes = new Map(); // midi -> { track, step, pos } for notes still being held
let lastTake = null;

live.getClip = getActiveTrack;
document.getElementById('live-loopmode').addEventListener('change', (e) => { live.state.loopMode = e.target.checked; });
document.getElementById('live-chord').addEventListener('change', (e) => { live.state.chord = e.target.checked; });
document.getElementById('live-metro').addEventListener('change', (e) => live.setMetronome(e.target.checked));

function stopRecording() {
  if (!recording) return;
  lastTake = recording;
  recording = null;
  recBtn.classList.remove('active');
  recBtn.textContent = '●';
  recUndo.disabled = false;
  setStatus('Take recorded');
}

recBtn.addEventListener('click', async () => {
  if (recording) return stopRecording();
  if (counting) return;
  const track = getActiveTrack();
  recBtn.classList.add('active');
  pushUndo();
  if (!engine.isPlaying()) {
    counting = true;
    setStatus('Count-in…');
    await live.countIn();
    counting = false;
    playBtn.click();
  }
  recording = {
    track,
    snapshot: track.cells.map((c) => new Set(c)),
    lengths: new Map(track.lengths),
  };
  recBtn.textContent = '■';
  setStatus('Recording… play your keys');
});

recUndo.addEventListener('click', () => {
  if (!lastTake) return;
  lastTake.track.cells = lastTake.snapshot;
  lastTake.track.lengths = lastTake.lengths;
  lastTake = null;
  recUndo.disabled = true;
  renderGrid();
});

stopBtn.addEventListener('click', stopRecording);

const transportSteps = () => Tone.Transport.ticks / (Tone.Transport.PPQ / 4); // position in 16th steps

// Notes are snapped to the chosen grid and written into the armed track's loop.
live.onNoteOn = (midi) => {
  if (!recording || !engine.isPlaying()) return;
  const q = Number(recQuant.value);
  const pos = transportSteps();
  const step = (Math.round(pos / q) * q) % engine.steps;
  recording.track.cells[step].add(midi);
  openNotes.set(midi, { track: recording.track, step, pos });
  if (recording.track.id === activeTrackId) renderGrid();
};

// Releasing a key (or the sustain pedal) fixes the note's length, snapped like its start.
live.onNoteOff = (midi) => {
  const open = openNotes.get(midi);
  if (!open) return;
  openNotes.delete(midi);
  const q = Number(recQuant.value);
  const len = Math.min(engine.steps - open.step, Math.max(1, Math.round((transportSteps() - open.pos) / q) * q));
  engine.setNoteLength(open.track.id, open.step, midi, len);
  if (open.track.id === activeTrackId) renderGrid();
};

// Buttons keep focus after a click, and Space would then re-click them; the keyboard is for playing.
document.addEventListener('click', (e) => e.target.closest('button')?.blur());

syncLengthSelect();
addTrack();
