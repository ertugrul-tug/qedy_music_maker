# Qedy Music Maker

A browser-based synth sequencer for creating game music. Compose multi-track loops (or full longer tracks) in a piano-roll/tracker grid, hit **Auto Build** for randomized scale-constrained patterns, load something from the built-in **Demo Library**, watch the live oscilloscope, and export the result as **WAV**, **MP3**, or **OGG**. Save/load full projects as `.qedy` files.

## Features

- Multi-track sequencer — add/remove tracks, each with an instrument preset, volume, mute, and its own pitch range
- Instrument presets — Sine/Square/Saw/Triangle leads, Bass, Sub Bass, FM Bell, Boss Hit (kick), Metal Percussion
- Piano-roll grid — 3 octaves per track, click to place/remove notes; out-of-range rows (per track pitch range) are dimmed; bar lines every 16 steps
- **Variable track length** — switch between short 2/4-bar loops (for quick iteration) and longer 8/16/32-bar tracks via the **Length** selector; all tracks resize together
- **Auto Build** — generates randomized, scale-constrained note patterns for one track or all tracks at once, with optional random instrument and tempo selection (root note, scale, and density are all adjustable)
- **Demo Library** — 32 built-in presets to load for testing/inspiration, split into groups:
  - *Original Loops* — short game-genre loops (Boss Battle, Village Theme, Dungeon Crawler, Space Battle, Horror Stinger, etc.)
  - *Original Tracks* — longer, developing arrangements (Final Boss Rush, Journey Suite)
  - *Original Epics* — full ~1-minute pieces with real intro/build/climax/outro structure (Epic Boss Battle, Grand Adventure Journey, Final Dungeon Descent)
  - *Public Domain Tracks* — simplified original transcriptions of famous melodies whose copyright has expired (Beethoven, Bach, Mozart, Wagner, Rossini, Grieg, Tchaikovsky, Rimsky-Korsakov, Pachelbel, Strauss, and a traditional folk tune) — full multi-section arrangements, not just an 8-note loop
- Live oscilloscope — real-time waveform of the mixed output
- Save/Load projects as `.qedy` files (JSON) — preserves tracks, instruments, notes, pitch ranges, tempo, length, and project name
- Adjustable tempo (BPM) and live playback with a moving playhead
- Export to WAV (instant, lossless), MP3, and OGG (encoded client-side via `ffmpeg.wasm`) — ready to drop into a game engine

## Tech stack

- [Vite](https://vite.dev/) — dev server / bundler, plain JS (no framework)
- [Tone.js](https://tonejs.github.io/) — Web Audio synthesis, scheduling, and offline rendering
- [`@ffmpeg/ffmpeg`](https://github.com/ffmpegwasm/ffmpeg.wasm) — in-browser transcoding of rendered audio to MP3/OGG

Everything runs client-side; no backend or audio files leave the browser.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL in a browser. Click **Play** to hear the pattern, use **Auto Build** to generate a loop, pick something from the **Demo Library**, or use the **Export** buttons to render and download an audio file.

> Note: the first MP3/OGG export downloads the ffmpeg.wasm encoder (a few MB) and may take a moment; subsequent exports in the same session are fast. WAV export has no such delay.

## A note on the public-domain demos

The public-domain entries are my own simplified transcriptions of melodies whose copyright has long expired (all composers died 70+ years ago, or the works predate modern copyright terms) — Beethoven, Bach, Mozart, Wagner, Rossini, Grieg, Tchaikovsky, Rimsky-Korsakov, Pachelbel, Richard Strauss, and a traditional English folk tune. Modern film/game scores (regardless of how iconic) are still under copyright and are intentionally **not** included.

## The `.qedy` project format

`.qedy` files are plain JSON containing the project name, tempo, step length, and every track's instrument, volume, mute state, pitch range, and note grid. Use **Save Project** / **Load Project** in the sidebar to round-trip a project. Older files (v1/v2, saved before instrument presets or variable length existed) still load — waveforms map onto the closest instrument preset, and length defaults to whatever the file's tracks contain.

## Project structure

```
src/
  audio/
    engine.js        # Track model, Tone.js synths, sequencer, master bus, variable length, offline rendering
    instruments.js    # Instrument presets (leads, bass, FM bell, percussive hits)
    generator.js       # Scale definitions + randomized pattern generation (Auto Build)
    export.js          # WAV encoding + ffmpeg.wasm transcoding to MP3/OGG
    project.js          # .qedy save/load (serialize/parse/apply)
    demoLibrary.js        # Built-in demo/preset tracks (original + public-domain)
  ui/
    pianoRoll.js     # Piano-roll grid rendering (width follows track length)
    oscilloscope.js  # Canvas waveform visualizer
  main.js       # App wiring (UI <-> engine)
  style.css
```

## Build for production

```bash
npm run build
```

Outputs a static site to `dist/`, which can be hosted anywhere (or embedded as a dev tool alongside your game project).

## Sampled instruments

Instruments labelled "(sampled)" (piano, strings, brass, woodwinds, guitars, sections and a full orchestra) use real recordings that the browser loads from public CDNs the first time they are used (roughly 3–20 MB each, then cached). They need an internet connection; synth instruments work offline. Credits: the [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) sample set and the Salamander Grand Piano by Alexander Holm, both licensed [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/). Keep this attribution if you ship music made with them.
