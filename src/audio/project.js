import { downloadBlob } from './export.js';
import { DEFAULT_INSTRUMENT, LEGACY_WAVEFORM_TO_INSTRUMENT } from './instruments.js';
import { DEFAULT_STEPS } from './engine.js';

export const QEDY_FORMAT = 'qedy';
export const QEDY_VERSION = 3;

// Converts live engine state into a plain, JSON-serializable project object.
export function serializeProject(engine, projectName = 'Untitled Project') {
  return {
    format: QEDY_FORMAT,
    version: QEDY_VERSION,
    name: projectName,
    bpm: engine.bpm,
    master: engine.masterDb,
    steps: engine.steps,
    tracks: engine.tracks.map((t) => ({
      name: t.name,
      instrument: t.instrument,
      volume: t.volume,
      muted: t.muted,
      solo: t.solo,
      pan: t.pan,
      reverb: t.reverb,
      delay: t.delay,
      rangeLow: t.rangeLow,
      rangeHigh: t.rangeHigh,
      cells: t.cells.map((set) => [...set]),
      lengths: Object.fromEntries(t.lengths),
    })),
  };
}

function sanitizeFilename(name) {
  return (name || 'project').trim().replace(/[\\/:*?"<>|]+/g, '_') || 'project';
}

export function saveProject(engine, projectName = 'Untitled Project') {
  const data = serializeProject(engine, projectName);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${sanitizeFilename(projectName)}.qedy`);
}

export function parseProjectFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }
  if (!data || data.format !== QEDY_FORMAT) {
    throw new Error('Not a valid .qedy project file');
  }
  return data;
}

function normalizeCells(cells, steps) {
  return Array.from({ length: steps }, (_, i) => cells?.[i] || []);
}

// Replaces all tracks in `engine` with the ones described by `data`.
// `createTrack` is the track-model factory from engine.js (injected to avoid a cycle).
export function applyProjectToEngine(engine, data, createTrack) {
  [...engine.tracks].forEach((t) => engine.removeTrack(t.id));

  engine.setBpm(data.bpm || 120);
  engine.setMasterVolume(data.master ?? 0);
  const steps = data.steps || data.tracks?.[0]?.cells?.length || DEFAULT_STEPS;
  engine.steps = steps;

  for (const saved of data.tracks || []) {
    const track = createTrack(saved.name, steps);
    // v1 files stored a raw oscillator "waveform"; v2+ store an instrument preset key.
    track.instrument =
      saved.instrument || LEGACY_WAVEFORM_TO_INSTRUMENT[saved.waveform] || DEFAULT_INSTRUMENT;
    track.volume = typeof saved.volume === 'number' ? saved.volume : -6;
    track.muted = !!saved.muted;
    track.solo = !!saved.solo;
    track.pan = saved.pan ?? 0;
    track.reverb = saved.reverb ?? 0;
    track.delay = saved.delay ?? 0;
    track.rangeLow = saved.rangeLow ?? track.rangeLow;
    track.rangeHigh = saved.rangeHigh ?? track.rangeHigh;
    track.cells = normalizeCells(saved.cells, steps).map((arr) => new Set(arr));
    track.lengths = new Map(Object.entries(saved.lengths || {}).map(([k, v]) => [k, Number(v)]));
    engine.addTrack(track);
  }

  return engine.tracks[0]?.id ?? null;
}
