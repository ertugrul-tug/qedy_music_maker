import * as Tone from 'tone';
import { buildVoice, midiToNoteName } from './engine.js';
import { SCALES } from './generator.js';

// Physical key positions (event.code), so it works on any layout: Turkish Q "a s d f g h j k l ş i".
export const HOME_ROW = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'];
// Chromatic mode: top row = black keys, as on a piano.
const BLACK_ROW = { KeyW: 1, KeyE: 3, KeyT: 6, KeyY: 8, KeyU: 10, KeyO: 13, KeyP: 15 };
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17];

// 16-step drum loops: k = kick, s = snare, h = hat
export const RHYTHMS = {
  rock: { label: 'Rock', k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  fourFloor: { label: 'Four on the floor', k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
  hiphop: { label: 'Hip-hop', k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xx' },
  trap: { label: 'Trap', k: 'x.......x.x.....', s: '........x.......', h: 'xxxxxxxxxxxxxxxx' },
  dnb: { label: 'Drum & Bass', k: 'x.........x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  reggae: { label: 'Reggae', k: '........x.......', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
};

export function createLive(engine) {
  const reverb = new Tone.Reverb({ decay: 3, wet: 0.25 }).connect(engine.master);
  let synth = null;
  let instrument = 'strings';
  const state = { scale: 'chromatic', root: 0, octave: 4, loopMode: false };
  const held = new Map(); // code -> midi
  const sustained = new Set(); // midi released while pedal is down
  let pedal = false;
  let onChange = () => {};
  let onNoteOn = () => {};
  let getClip = () => null; // -> track whose cells are the loop clip
  const loops = new Map(); // code -> Tone.Sequence (key-triggered clip loops)
  let drumSeq = null;

  function maybeStopTransport() {
    if (!engine.sequence && !drumSeq && loops.size === 0) Tone.Transport.stop();
  }

  // Metronome: quiet click on every beat while the transport runs.
  const click = new Tone.Synth({ envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 } }).connect(engine.master);
  click.volume.value = -14;
  const metro = new Tone.Loop((time) => click.triggerAttackRelease('C6', '32n', time), '4n');
  metro.mute = true;
  metro.start(0);

  function setInstrument(key) {
    instrument = key;
    if (synth) synth.dispose();
    synth = buildVoice(key).connect(reverb);
  }
  setInstrument(instrument);

  // midi note for a key code under the current scale/octave, or null
  function noteFor(code) {
    const base = 12 * (state.octave + 1) + state.root;
    const white = HOME_ROW.indexOf(code);
    if (state.scale === 'chromatic') {
      if (white >= 0) return base + WHITE_SEMITONES[white];
      return code in BLACK_ROW ? base + BLACK_ROW[code] : null;
    }
    if (white < 0) return null;
    const iv = SCALES[state.scale];
    return base + iv[white % iv.length] + 12 * Math.floor(white / iv.length);
  }

  const name = (m) => midiToNoteName(m);

  function noteOn(code) {
    const midi = noteFor(code);
    if (midi === null || held.has(code)) return;
    if (state.loopMode && startLoop(code, midi)) return;
    if (sustained.delete(midi)) synth.triggerRelease(name(midi));
    held.set(code, midi);
    synth.triggerAttack(name(midi));
    onNoteOn(midi);
    onChange();
  }

  // Loop mode: holding a key loops the active track's clip, transposed so the clip's
  // first note lands on the pressed key. Releasing the key stops it.
  function startLoop(code, midi) {
    const clip = getClip();
    const first = clip && clip.cells.findIndex((c) => c.size > 0);
    if (!clip || first < 0) return false;
    const root = Math.min(...clip.cells[first]);
    const shift = midi - root;
    Tone.Transport.start();
    const seq = new Tone.Sequence((time, step) => {
      for (const m of clip.cells[step]) synth.triggerAttackRelease(name(m + shift), '16n', time);
    }, [...Array(clip.cells.length).keys()], '16n');
    seq.start('@16n');
    loops.set(code, seq);
    held.set(code, midi);
    onChange();
    return true;
  }

  function noteOff(code) {
    const midi = held.get(code);
    if (midi === undefined) return;
    held.delete(code);
    const loop = loops.get(code);
    if (loop) {
      loop.stop();
      loop.dispose();
      loops.delete(code);
      maybeStopTransport();
      onChange();
      return;
    }
    if (pedal) sustained.add(midi);
    else synth.triggerRelease(name(midi));
    onChange();
  }

  function setPedal(down) {
    pedal = down;
    if (down) return;
    const stillHeld = new Set(held.values());
    for (const m of sustained) if (!stillHeld.has(m)) synth.triggerRelease(name(m));
    sustained.clear();
  }

  function releaseAll() {
    synth.releaseAll();
    for (const l of loops.values()) { l.stop(); l.dispose(); }
    loops.clear();
    held.clear();
    sustained.clear();
    onChange();
  }

  function onKeyDown(e) {
    const t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { Tone.start(); setPedal(true); onChange(); } return; }
    if (e.repeat) return;
    if (e.code === 'KeyZ') { releaseAll(); state.octave = Math.max(0, state.octave - 1); onChange(); return; }
    if (e.code === 'KeyX') { releaseAll(); state.octave = Math.min(7, state.octave + 1); onChange(); return; }
    if (noteFor(e.code) !== null) { Tone.start(); noteOn(e.code); }
  }
  function onKeyUp(e) {
    if (e.code === 'Space') { setPedal(false); onChange(); return; }
    noteOff(e.code);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => { setPedal(false); releaseAll(); });

  // ---- drums ----
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5 }).connect(engine.master);
  const snare = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.15, sustain: 0 } }).connect(engine.master);
  const hat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, resonance: 6000, octaves: 1 });
  hat.volume.value = -22;
  hat.connect(engine.master);
  snare.volume.value = -8;
  kick.volume.value = -4;
  let rhythm = 'rock';

  function stopDrums() {
    if (!drumSeq) return;
    drumSeq.stop();
    drumSeq.dispose();
    drumSeq = null;
    maybeStopTransport();
  }

  async function startDrums() {
    await Tone.start();
    stopDrums();
    const r = RHYTHMS[rhythm];
    drumSeq = new Tone.Sequence((time, i) => {
      if (r.k[i] === 'x') kick.triggerAttackRelease('C1', '8n', time);
      if (r.s[i] === 'x') snare.triggerAttackRelease('16n', time);
      if (r.h[i] === 'x') hat.triggerAttackRelease('C6', '32n', time);
    }, [...Array(16).keys()], '16n');
    drumSeq.start(0);
    Tone.Transport.start();
  }

  return {
    state,
    keyLabels: () => HOME_ROW.map((code) => ({ code, midi: noteFor(code) })),
    heldMidis: () => new Set(held.values()),
    isPedal: () => pedal,
    setInstrument,
    setRhythm: (k) => { rhythm = k; if (drumSeq) startDrums(); },
    startDrums,
    stopDrums,
    isDrumming: () => !!drumSeq,
    set onChange(fn) { onChange = fn; },
    set onNoteOn(fn) { onNoteOn = fn; },
    set getClip(fn) { getClip = fn; },
    setMetronome: (on) => { metro.mute = !on; },
  };
}
