import './style.css';
import { Engine, createTrack, LOW_MIDI, HIGH_MIDI, midiToNoteName } from './audio/engine.js';
import { INSTRUMENTS, INSTRUMENT_KEYS } from './audio/instruments.js';
import { renderPianoRoll, updatePlayhead } from './ui/pianoRoll.js';
import { startOscilloscopeLoop } from './ui/oscilloscope.js';
import { audioBufferToWav, transcodeWav, downloadBlob } from './audio/export.js';
import { ROOT_NAMES } from './audio/generator.js';
import { saveProject, parseProjectFile, applyProjectToEngine } from './audio/project.js';
import { DEMOS } from './audio/demoLibrary.js';

const engine = new Engine();
let activeTrackId = null;

const trackTabsEl = document.getElementById('track-tabs');
const trackControlsEl = document.getElementById('track-controls');
const pianoRollEl = document.getElementById('piano-roll-container');
const statusEl = document.getElementById('status');
const playBtn = document.getElementById('play-btn');
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
  engine.setLength(Number(lengthSelect.value));
  renderAll();
  setStatus(`Length set to ${engine.steps} steps`);
});

function renderTabs() {
  trackTabsEl.innerHTML = '';
  engine.tracks.forEach((track) => {
    const tab = document.createElement('button');
    tab.className = 'track-tab' + (track.id === activeTrackId ? ' active' : '');
    tab.textContent = track.name;
    tab.addEventListener('click', () => {
      activeTrackId = track.id;
      renderAll();
    });
    trackTabsEl.appendChild(tab);
  });
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
    muteBtn.classList.toggle('active', track.muted);
    muteBtn.textContent = track.muted ? 'Muted' : 'Mute';
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
    engine.clearTrack(track.id);
    renderGrid();
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn small danger';
  removeBtn.textContent = 'Remove Track';
  removeBtn.addEventListener('click', () => {
    if (engine.tracks.length <= 1) return;
    engine.removeTrack(track.id);
    activeTrackId = engine.tracks[0].id;
    renderAll();
  });

  trackControlsEl.append(
    nameInput,
    instrumentSelect,
    volLabel,
    rangeLabel,
    muteBtn,
    randomizeBtn,
    clearBtn,
    removeBtn
  );
}

function renderGrid() {
  const track = getActiveTrack();
  if (!track) return;
  renderPianoRoll(pianoRollEl, track, (step, midi) => {
    engine.toggleNote(track.id, step, midi);
    renderGrid();
  }, -1);
}

function renderAll() {
  renderTabs();
  renderControls();
  renderGrid();
}

playBtn.addEventListener('click', async () => {
  setStatus('Playing…');
  engine.onStep = (step) => updatePlayhead(pianoRollEl, step);
  await engine.play();
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
    if (engine.isPlaying()) engine.stop();
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
  if (engine.isPlaying()) engine.stop();
  const firstId = applyProjectToEngine(engine, demo.data, createTrack);
  activeTrackId = firstId;
  bpmInput.value = String(engine.bpm);
  projectNameInput.value = demo.label;
  syncLengthSelect();
  renderAll();
  setStatus(`Loaded demo: ${demo.label}`);
});

syncLengthSelect();
addTrack();
