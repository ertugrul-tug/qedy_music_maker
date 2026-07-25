// Builds a `steps`-length cell array (plain arrays of MIDI numbers, matching the .qedy
// project schema) from a sparse list of [step, note|notes] events.
function makeCells(steps, events) {
  const cells = Array.from({ length: steps }, () => []);
  for (const [step, notes] of events) {
    if (step < 0 || step >= steps) continue;
    cells[step] = Array.isArray(notes) ? notes : [notes];
  }
  return cells;
}

// A single note/chord repeated every `n` steps starting at `startOffset`.
function everyN(totalSteps, n, notes, startOffset = 0) {
  const events = [];
  for (let s = startOffset; s < totalSteps; s += n) events.push([s, notes]);
  return events;
}

// Repeats a short motif (events relative to a `patternLength`-step bar) across `totalSteps`.
function repeatPattern(totalSteps, patternLength, patternEvents) {
  const events = [];
  for (let base = 0; base < totalSteps; base += patternLength) {
    for (const [step, notes] of patternEvents) {
      if (base + step < totalSteps) events.push([base + step, notes]);
    }
  }
  return events;
}

// Shifts every event's step by `stepOffset`.
function shift(events, stepOffset) {
  return events.map(([step, notes]) => [step + stepOffset, notes]);
}

// Transposes every note in `events` by `semitones` (handles chords too).
function transpose(events, semitones) {
  return events.map(([step, notes]) => [
    step,
    Array.isArray(notes) ? notes.map((n) => n + semitones) : notes + semitones,
  ]);
}

// Keeps only events whose step falls within [start, end).
function inRange(events, start, end) {
  return events.filter(([s]) => s >= start && s < end);
}

function track({ name, instrument, volume = -6, rangeLow, rangeHigh, steps, events }) {
  return {
    name,
    instrument,
    volume,
    muted: false,
    rangeLow,
    rangeHigh,
    cells: makeCells(steps, events),
  };
}

// length: 'loop' (short, repeats cleanly, good for quick iteration/testing) or
// 'track' (longer, multi-section, meant to be heard start-to-finish).
function demo({ id, label, description, category, length, bpm, steps, tracks }) {
  return {
    id,
    label,
    description,
    category, // 'original' | 'public-domain'
    length, // 'loop' | 'track'
    data: { format: 'qedy', version: 3, name: label, bpm, steps, tracks },
  };
}

const LOOP_STEPS = 32; // 2 bars — quick repeating game loops

// steps = bpm * 4 gives exactly 60 seconds of playback (16th-note grid),
// so "epic" demos land right around one minute with real structure, not just a longer loop.

export const DEMOS = [
  // ============================================================
  // Original demos — composed for this app, no external source.
  // Game loop music genuinely is meant to loop, so these stay short.
  // ============================================================
  demo({
    id: 'boss-battle',
    label: 'Boss Battle (Demo)',
    description: 'Driving A-minor riff with a punchy kick and bass — original demo loop.',
    category: 'original', length: 'loop', bpm: 150, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Kick', instrument: 'bossHit', rangeLow: 48, rangeHigh: 60, steps: LOOP_STEPS,
        events: everyN(LOOP_STEPS, 4, 57) }),
      track({ name: 'Bass', instrument: 'bass', rangeLow: 48, rangeHigh: 60, steps: LOOP_STEPS,
        events: repeatPattern(LOOP_STEPS, 16, [[0, 57], [2, 57], [4, 52], [6, 57], [8, 57], [10, 57], [12, 52], [14, 55]]) }),
      track({ name: 'Riff', instrument: 'sawLead', rangeLow: 60, rangeHigh: 76, steps: LOOP_STEPS,
        events: [[6, 69], [14, 72], [22, 71], [30, 69]] }),
    ],
  }),

  demo({
    id: 'village-theme',
    label: 'Village Theme (Demo)',
    description: 'Gentle C-major pentatonic melody over soft pad chords — original demo loop.',
    category: 'original', length: 'loop', bpm: 100, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Pad', instrument: 'trianglePad', volume: -10, rangeLow: 48, rangeHigh: 67, steps: LOOP_STEPS,
        events: [[0, [60, 64, 67]], [8, [57, 60, 64]], [16, [60, 64, 67]], [24, [62, 65, 69]]] }),
      track({ name: 'Melody', instrument: 'sineLead', rangeLow: 60, rangeHigh: 81, steps: LOOP_STEPS,
        events: [[2, 76], [4, 79], [6, 76], [10, 74], [12, 72], [14, 74], [18, 76], [20, 79], [22, 81], [26, 79], [28, 76], [30, 74]] }),
    ],
  }),

  demo({
    id: 'dungeon-crawler',
    label: 'Dungeon Crawler (Demo)',
    description: 'Sparse D-minor drone with eerie metallic accents — original demo loop.',
    category: 'original', length: 'loop', bpm: 90, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Drone', instrument: 'subBass', rangeLow: 48, rangeHigh: 60, steps: LOOP_STEPS,
        events: [[0, 50], [8, 57], [16, 50], [24, 53]] }),
      track({ name: 'Accents', instrument: 'metalPercussion', volume: -12, rangeLow: 60, rangeHigh: 72, steps: LOOP_STEPS,
        events: [[3, 65], [7, 67], [11, 65], [19, 67], [23, 65], [27, 67]] }),
    ],
  }),

  demo({
    id: 'victory-fanfare',
    label: 'Victory Fanfare (Demo)',
    description: 'Short triumphant C-major arpeggio — original demo loop.',
    category: 'original', length: 'loop', bpm: 130, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Fanfare', instrument: 'fmBell', rangeLow: 60, rangeHigh: 83, steps: LOOP_STEPS,
        events: [[0, 72], [2, 76], [4, 79], [6, 83], [8, [72, 76, 79]], [16, 72], [18, 76], [20, 79], [22, 83], [24, [72, 76, 79]]] }),
    ],
  }),

  demo({
    id: 'menu-theme',
    label: 'Menu Theme (Demo)',
    description: 'Calm A-minor ambient pad with sparse melody — original demo loop.',
    category: 'original', length: 'loop', bpm: 80, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Pad', instrument: 'trianglePad', volume: -12, rangeLow: 48, rangeHigh: 64, steps: LOOP_STEPS,
        events: [[0, [57, 60, 64]], [16, [53, 57, 60]]] }),
      track({ name: 'Melody', instrument: 'sineLead', volume: -8, rangeLow: 60, rangeHigh: 76, steps: LOOP_STEPS,
        events: [[4, 76], [12, 72], [20, 69], [28, 76]] }),
    ],
  }),

  demo({
    id: 'space-battle',
    label: 'Space Battle (Demo)',
    description: 'Tense sci-fi pulse with a siren-like lead — original demo loop.',
    category: 'original', length: 'loop', bpm: 160, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Kick', instrument: 'bossHit', rangeLow: 48, rangeHigh: 60, steps: LOOP_STEPS,
        events: everyN(LOOP_STEPS, 4, 50) }),
      track({ name: 'Bass', instrument: 'bass', rangeLow: 48, rangeHigh: 60, steps: LOOP_STEPS,
        events: repeatPattern(LOOP_STEPS, 16, [[0, 50], [2, 50], [4, 57], [6, 50], [8, 50], [10, 50], [12, 57], [14, 53]]) }),
      track({ name: 'Siren', instrument: 'sawLead', volume: -8, rangeLow: 60, rangeHigh: 83, steps: LOOP_STEPS,
        events: [[6, 74], [14, 77], [22, 74], [30, 79]] }),
    ],
  }),

  demo({
    id: 'ambient-exploration',
    label: 'Ambient Exploration (Demo)',
    description: 'Spacious, slow-moving pad and drone for exploration areas — original demo loop.',
    category: 'original', length: 'loop', bpm: 70, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Drone', instrument: 'subBass', volume: -10, rangeLow: 48, rangeHigh: 60, steps: LOOP_STEPS,
        events: [[0, 50], [16, 53]] }),
      track({ name: 'Pad', instrument: 'trianglePad', volume: -12, rangeLow: 48, rangeHigh: 72, steps: LOOP_STEPS,
        events: [[4, [60, 64, 67]], [20, [65, 69, 72]]] }),
    ],
  }),

  demo({
    id: 'retro-action',
    label: 'Retro Action (Demo)',
    description: 'Upbeat chiptune arpeggio with a punchy kick — original demo loop.',
    category: 'original', length: 'loop', bpm: 140, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Kick', instrument: 'bossHit', rangeLow: 48, rangeHigh: 60, steps: LOOP_STEPS,
        events: everyN(LOOP_STEPS, 8, 57) }),
      track({ name: 'Arpeggio', instrument: 'squareLead', rangeLow: 60, rangeHigh: 83, steps: LOOP_STEPS,
        events: repeatPattern(LOOP_STEPS, 16, [[0, 72], [2, 76], [4, 79], [6, 76], [8, 72], [10, 76], [12, 79], [14, 83]]) }),
    ],
  }),

  demo({
    id: 'sad-ending',
    label: 'Sad Ending (Demo)',
    description: 'Slow, melancholic minor-key theme — original demo loop.',
    category: 'original', length: 'loop', bpm: 60, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Pad', instrument: 'trianglePad', volume: -12, rangeLow: 48, rangeHigh: 64, steps: LOOP_STEPS,
        events: [[0, [57, 60, 64]], [16, [53, 57, 60]]] }),
      track({ name: 'Melody', instrument: 'sineLead', volume: -8, rangeLow: 60, rangeHigh: 72, steps: LOOP_STEPS,
        events: [[4, 69], [12, 67], [20, 64], [28, 62]] }),
    ],
  }),

  demo({
    id: 'underwater-level',
    label: 'Underwater Level (Demo)',
    description: 'Bubbly, drifting FM textures for an aquatic level — original demo loop.',
    category: 'original', length: 'loop', bpm: 85, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Drone', instrument: 'subBass', volume: -12, rangeLow: 48, rangeHigh: 60, steps: LOOP_STEPS,
        events: [[0, 48], [16, 53]] }),
      track({ name: 'Bubbles', instrument: 'fmBell', volume: -10, rangeLow: 60, rangeHigh: 83, steps: LOOP_STEPS,
        events: [[2, 74], [6, 79], [10, 76], [14, 81], [18, 74], [22, 79], [26, 77], [30, 83]] }),
    ],
  }),

  demo({
    id: 'desert-trek',
    label: 'Desert Trek (Demo)',
    description: 'Sparse, dry, wide-interval melody for a long overworld trek — original demo loop.',
    category: 'original', length: 'loop', bpm: 95, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Bass', instrument: 'bass', volume: -8, rangeLow: 48, rangeHigh: 60, steps: LOOP_STEPS,
        events: everyN(LOOP_STEPS, 8, 52) }),
      track({ name: 'Melody', instrument: 'sawLead', volume: -6, rangeLow: 60, rangeHigh: 76, steps: LOOP_STEPS,
        events: [[0, 64], [6, 71], [12, 67], [18, 74], [24, 64], [30, 69]] }),
    ],
  }),

  demo({
    id: 'arcade-highscore',
    label: 'Arcade High Score (Demo)',
    description: 'Bright, fast major-key chiptune hook for a title/high-score screen — original demo loop.',
    category: 'original', length: 'loop', bpm: 165, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Kick', instrument: 'bossHit', rangeLow: 48, rangeHigh: 60, steps: LOOP_STEPS,
        events: everyN(LOOP_STEPS, 4, 55) }),
      track({ name: 'Hook', instrument: 'squareLead', rangeLow: 60, rangeHigh: 83, steps: LOOP_STEPS,
        events: repeatPattern(LOOP_STEPS, 8, [[0, 72], [2, 76], [4, 79], [6, 76]]) }),
    ],
  }),

  demo({
    id: 'horror-stinger',
    label: 'Horror Stinger (Demo)',
    description: 'Dissonant, sparse metallic hits for a jump-scare cue — original demo loop.',
    category: 'original', length: 'loop', bpm: 70, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Drone', instrument: 'subBass', volume: -8, rangeLow: 48, rangeHigh: 55, steps: LOOP_STEPS,
        events: [[0, 49]] }),
      track({ name: 'Stab', instrument: 'metalPercussion', volume: -6, rangeLow: 60, rangeHigh: 80, steps: LOOP_STEPS,
        events: [[0, [61, 67, 73]], [20, 68]] }),
    ],
  }),

  demo({
    id: 'credits-roll',
    label: 'Credits Roll (Demo)',
    description: 'Warm, resolving major-key theme for end credits — original demo loop.',
    category: 'original', length: 'loop', bpm: 90, steps: LOOP_STEPS,
    tracks: [
      track({ name: 'Pad', instrument: 'trianglePad', volume: -10, rangeLow: 48, rangeHigh: 72, steps: LOOP_STEPS,
        events: [[0, [60, 64, 67]], [16, [65, 69, 72]]] }),
      track({ name: 'Melody', instrument: 'fmBell', volume: -8, rangeLow: 60, rangeHigh: 81, steps: LOOP_STEPS,
        events: [[0, 67], [4, 72], [8, 76], [16, 72], [20, 76], [24, 81]] }),
    ],
  }),

  // --- Original longer tracks ---
  demo({
    id: 'final-boss-rush',
    label: 'Final Boss Rush (Demo)',
    description: 'A developing boss-fight arrangement that builds to a climax — original demo track (6 bars, does not loop like the others).',
    category: 'original', length: 'track', bpm: 150, steps: 96,
    tracks: [
      track({ name: 'Kick', instrument: 'bossHit', rangeLow: 48, rangeHigh: 60, steps: 96,
        events: everyN(96, 4, 57) }),
      track({ name: 'Bass', instrument: 'bass', rangeLow: 48, rangeHigh: 60, steps: 96,
        events: repeatPattern(96, 16, [[0, 57], [2, 57], [4, 52], [6, 57], [8, 57], [10, 57], [12, 52], [14, 55]]) }),
      track({ name: 'Riff', instrument: 'sawLead', rangeLow: 60, rangeHigh: 83, steps: 96,
        events: [
          ...repeatPattern(64, 32, [[6, 69], [14, 72], [22, 71], [30, 69]]),
          [64, 72], [66, 76], [68, 79], [70, 83], [72, 79], [74, 76], [76, 72],
          [78, 69], [80, 72], [82, 76], [84, 79], [86, 83], [88, [72, 76, 79, 83]],
        ] }),
    ],
  }),

  demo({
    id: 'journey-suite',
    label: 'Journey Suite (Demo)',
    description: 'A mood-shifting adventure suite: calm start, tension build, triumphant finish — original demo track (8 bars).',
    category: 'original', length: 'track', bpm: 110, steps: 128,
    tracks: [
      track({ name: 'Pad/Bass', instrument: 'trianglePad', volume: -10, rangeLow: 48, rangeHigh: 72, steps: 128,
        events: [
          [0, [60, 64, 67]], [16, [57, 60, 64]], // calm section
          [32, [62, 65, 69]], [40, [59, 62, 67]], // tension build
          [64, [60, 64, 67]], [72, [65, 69, 72]], // rising
          [96, [60, 64, 67, 72]], [112, [65, 69, 72, 77]], // triumphant finish
        ] }),
      track({ name: 'Melody', instrument: 'sineLead', volume: -6, rangeLow: 60, rangeHigh: 81, steps: 128,
        events: [
          [4, 72], [10, 76], [20, 74],
          [36, 74], [42, 77], [48, 76], [54, 79],
          [68, 76], [74, 79], [80, 81],
          [96, 79], [100, 81], [104, 79], [108, 79], [112, 81], [120, 76],
        ] }),
      track({ name: 'Kick', instrument: 'bossHit', volume: -8, rangeLow: 48, rangeHigh: 60, steps: 128,
        events: everyN(128, 8, 57, 64) }),
    ],
  }),

  // --- Original epics: ~1 minute, real intro/build/climax/outro structure ---
  demo({
    id: 'epic-boss-battle',
    label: 'Epic Boss Battle — Full (Demo)',
    description: 'A full-length boss fight: ominous intro, groove buildup, sustained battle, dense climax, and a resolving outro — original demo epic (35 bars, ~1 minute).',
    category: 'original', length: 'epic', bpm: 140, steps: 560, // 140*4 = 560 -> exactly 60s
    tracks: [
      track({ name: 'Kick', instrument: 'bossHit', rangeLow: 48, rangeHigh: 60, steps: 560,
        events: [
          ...inRange(everyN(560, 4, 57), 64, 448),
          ...inRange(everyN(560, 2, 57), 448, 512),
          ...inRange(everyN(560, 16, 57), 512, 560),
        ] }),
      track({ name: 'Bass', instrument: 'bass', rangeLow: 48, rangeHigh: 60, steps: 560,
        events: inRange(
          repeatPattern(560, 16, [[0, 52], [2, 52], [4, 57], [6, 52], [8, 52], [10, 52], [12, 57], [14, 55]]),
          64, 512
        ) }),
      track({ name: 'Riff', instrument: 'sawLead', rangeLow: 60, rangeHigh: 83, steps: 560,
        events: [
          // intro: sparse, mysterious, low
          [8, 64], [24, 67], [40, 64], [56, 60],
          // main battle groove
          ...inRange(repeatPattern(560, 32, [[6, 69], [14, 72], [22, 71], [30, 69]]), 64, 448),
          // climax: dense run
          [448, 72], [450, 76], [452, 79], [454, 83], [456, 79], [458, 76], [460, 72], [462, 69],
          [464, 72], [466, 76], [468, 79], [470, 83], [472, 79], [474, 76], [476, 72], [478, 69],
          [480, 72], [482, 76], [484, 79], [486, 83], [488, [72, 76, 79, 83]],
          [496, 72], [498, 76], [500, 79], [502, 83], [504, [72, 76, 79, 83]],
          // outro: resolving low note, then silence
          [512, 72], [544, 60],
        ] }),
    ],
  }),

  demo({
    id: 'grand-adventure-journey',
    label: 'Grand Adventure Journey — Full (Demo)',
    description: 'A full mood arc: peaceful village, travel tension, a battle section, and a triumphant homecoming — original demo epic (30 bars, ~1 minute).',
    category: 'original', length: 'epic', bpm: 120, steps: 480, // 120*4 = 480 -> exactly 60s
    tracks: [
      track({ name: 'Pad', instrument: 'trianglePad', volume: -10, rangeLow: 48, rangeHigh: 72, steps: 480,
        events: [
          // village (calm)
          ...inRange(repeatPattern(128, 32, [[0, [60, 64, 67]], [16, [57, 60, 64]]]), 0, 128),
          // travel (tension)
          ...inRange(repeatPattern(128, 32, [[0, [62, 65, 69]], [16, [59, 62, 67]]]), 128, 256),
          // battle (driving, handled mostly by bass/kick below; pad sustains a tense chord)
          ...inRange(everyN(480, 32, [57, 60, 64, 69]), 256, 384),
          // triumphant homecoming
          ...inRange(repeatPattern(96, 32, [[0, [60, 64, 67, 72]], [16, [65, 69, 72, 77]]]), 0, 96).map(([s, n]) => [s + 384, n]),
        ] }),
      track({ name: 'Melody', instrument: 'sineLead', volume: -6, rangeLow: 60, rangeHigh: 81, steps: 480,
        events: [
          // village
          [8, 76], [24, 79], [40, 76], [56, 74], [72, 76], [88, 79], [104, 81], [120, 79],
          // travel
          [136, 74], [152, 77], [168, 74], [184, 71], [200, 74], [216, 77], [232, 79], [248, 76],
          // battle (sparser, punchier, alternates with kick hits)
          [264, 81], [272, 77], [280, 81], [288, 77], [296, 81], [304, 77], [312, 79], [320, 77],
          [328, 81], [336, 77], [344, 81], [352, 77], [360, 81], [368, 77], [376, 79], [380, 77],
          // homecoming
          [388, 79], [396, 81], [404, 79], [412, 81], [420, 79], [436, 81], [452, 79], [468, 76],
        ] }),
      track({ name: 'Kick', instrument: 'bossHit', volume: -8, rangeLow: 48, rangeHigh: 60, steps: 480,
        events: inRange(everyN(480, 4, 57), 256, 384) }),
      track({ name: 'Bass', instrument: 'bass', volume: -8, rangeLow: 48, rangeHigh: 57, steps: 480,
        events: inRange(repeatPattern(480, 16, [[0, 57], [4, 57], [8, 52], [12, 55]]), 256, 384) }),
    ],
  }),

  demo({
    id: 'final-dungeon-descent',
    label: 'Final Dungeon Descent — Full (Demo)',
    description: 'A full descent into darkness: distant drone, growing percussive dread, a full dark groove, a climactic sting, and silence — original demo epic (25 bars, ~1 minute).',
    category: 'original', length: 'epic', bpm: 100, steps: 400, // 100*4 = 400 -> exactly 60s
    tracks: [
      track({ name: 'Drone', instrument: 'subBass', volume: -10, rangeLow: 48, rangeHigh: 60, steps: 400,
        events: everyN(400, 32, 50) }),
      track({ name: 'Accents', instrument: 'metalPercussion', volume: -14, rangeLow: 60, rangeHigh: 72, steps: 400,
        events: [
          // sparse at first, then increasingly frequent (growing dread)
          [16, 65], [48, 67],
          [96, 65], [112, 67],
          [160, 65], [172, 67], [184, 65],
          [224, 65], [232, 67], [240, 65], [248, 67],
          [288, 65], [292, 67], [296, 65], [300, 67], [304, 65],
        ] }),
      track({ name: 'Groove Bass', instrument: 'bass', volume: -8, rangeLow: 48, rangeHigh: 57, steps: 400,
        events: inRange(repeatPattern(400, 16, [[0, 50], [4, 50], [8, 53], [12, 55]]), 224, 352) }),
      track({ name: 'Kick', instrument: 'bossHit', volume: -6, rangeLow: 48, rangeHigh: 55, steps: 400,
        events: inRange(everyN(400, 8, 48), 224, 352) }),
      track({ name: 'Sting', instrument: 'fmBell', rangeLow: 55, rangeHigh: 77, steps: 400,
        events: [[352, [55, 58, 62, 67, 74]]] }),
    ],
  }),

  // ============================================================
  // Public-domain classical adaptations — simplified, original
  // transcriptions of melodies whose copyright has long expired.
  // Kept as full multi-section tracks so you can hear a real
  // arc, not just an 8-note loop.
  // ============================================================
  demo({
    id: 'fur-elise',
    label: 'Für Elise (Public Domain)',
    description: 'Multi-section transcription: main theme, rolling arpeggio passage, reprise, and closing cadence — Beethoven, 1810 (public domain).',
    category: 'public-domain', length: 'track', bpm: 120, steps: 128,
    tracks: [
      track({ name: 'Melody', instrument: 'fmBell', rangeLow: 60, rangeHigh: 81, steps: 128,
        events: [
          // A section: main theme
          [0, 76], [1, 75], [2, 76], [3, 75], [4, 76], [5, 71], [6, 74], [7, 72],
          [8, 69], [12, 60], [13, 64], [14, 69],
          [16, 64], [17, 68], [18, 71], [19, 72],
          [24, 76], [25, 75], [26, 76], [27, 75], [28, 76], [29, 71], [30, 74], [31, 72],
          // B section: rolling broken-chord passage
          ...repeatPattern(32, 8, [[0, 52], [2, 56], [4, 59], [6, 64]], ).map(([s, n]) => [s + 32, n]),
          // A section reprise
          ...shift([
            [0, 76], [1, 75], [2, 76], [3, 75], [4, 76], [5, 71], [6, 74], [7, 72],
            [8, 69], [12, 60], [13, 64], [14, 69],
            [16, 64], [17, 68], [18, 71], [19, 72],
            [24, 76], [25, 75], [26, 76], [27, 75], [28, 76], [29, 71], [30, 74], [31, 72],
          ], 64),
          // closing descending cadence
          [96, 81], [98, 79], [100, 77], [102, 76], [104, 74], [106, 72], [108, 71], [110, 69],
          [112, [57, 60, 64]],
        ] }),
    ],
  }),

  demo({
    id: 'ode-to-joy',
    label: 'Ode to Joy (Public Domain)',
    description: 'Main theme repeated with a simple bass harmonization added on the second and third pass — Beethoven, Symphony No. 9, 1824 (public domain).',
    category: 'public-domain', length: 'track', bpm: 112, steps: 128,
    tracks: [
      track({ name: 'Melody', instrument: 'sineLead', rangeLow: 60, rangeHigh: 67, steps: 128,
        events: repeatPattern(128, 32, [
          [0, 64], [2, 64], [4, 65], [6, 67], [8, 67], [10, 65], [12, 64], [14, 62],
          [16, 60], [18, 60], [20, 62], [22, 64], [24, 64], [26, 62], [28, 62],
        ]) }),
      track({ name: 'Bass', instrument: 'bass', volume: -10, rangeLow: 48, rangeHigh: 60, steps: 128,
        events: shift(repeatPattern(96, 32, [[0, 48], [8, 53], [16, 55], [24, 48]]), 32) }),
    ],
  }),

  demo({
    id: 'mountain-king',
    label: 'In the Hall of the Mountain King (Public Domain)',
    description: 'The famous rising crescendo structure: the motif restated an octave higher, then faster, then combined — Edvard Grieg, 1875 (public domain).',
    category: 'public-domain', length: 'track', bpm: 140, steps: 128,
    tracks: [
      track({ name: 'Motif', instrument: 'bass', rangeLow: 48, rangeHigh: 81, steps: 128,
        events: [
          // pass 1: low register
          [0, 62], [2, 64], [4, 65], [6, 67], [8, 69], [10, 65], [12, 62],
          // pass 2: octave up
          ...transpose([[16, 62], [18, 64], [20, 65], [22, 67], [24, 69], [26, 65], [28, 62]], 12),
          // pass 3: low again, building
          [32, 62], [34, 64], [36, 65], [38, 67], [40, 69], [42, 65], [44, 62],
          // pass 4: octave up, faster (half the spacing)
          ...transpose([[48, 62], [49, 64], [50, 65], [51, 67], [52, 69], [53, 65], [54, 62]], 12),
          // full-speed final build across the last two bars
          ...repeatPattern(64, 16, [[0, 62], [2, 64], [4, 65], [6, 67], [8, 69], [10, 67], [12, 65], [14, 62]], ).map(([s, n]) => [s + 64, n]),
        ] }),
      track({ name: 'Kick', instrument: 'bossHit', volume: -6, rangeLow: 48, rangeHigh: 55, steps: 128,
        events: everyN(128, 16, 48, 64) }),
    ],
  }),

  demo({
    id: 'ride-of-valkyries',
    label: 'Ride of the Valkyries (Public Domain)',
    description: 'Fanfare motif repeated with a rising bass pulse and a final octave-lifted restatement — Richard Wagner, 1870 (public domain).',
    category: 'public-domain', length: 'track', bpm: 140, steps: 128,
    tracks: [
      track({ name: 'Fanfare', instrument: 'sawLead', rangeLow: 60, rangeHigh: 83, steps: 128,
        events: [
          ...repeatPattern(96, 32, [
            [0, 71], [2, 71], [4, 74], [6, 71], [8, 78], [10, 74], [12, 71],
            [16, 71], [18, 71], [20, 74], [22, 71], [24, 83], [26, 78], [28, 74], [30, 71],
          ]),
          // final restatement, big sustained chord finish
          ...shift([
            [0, 71], [2, 71], [4, 74], [6, 71], [8, 78], [10, 74], [12, 71],
            [16, 71], [18, 71], [20, 74], [22, 71], [24, [71, 74, 78, 83]],
          ], 96),
        ] }),
      track({ name: 'Bass Pulse', instrument: 'bass', volume: -8, rangeLow: 48, rangeHigh: 57, steps: 128,
        events: everyN(128, 4, 51) }),
    ],
  }),

  demo({
    id: 'william-tell',
    label: 'William Tell Overture Finale (Public Domain)',
    description: 'The galloping finale, repeated five times with kick-driven "hooves" and a big final chord — Gioachino Rossini, 1829 (public domain).',
    category: 'public-domain', length: 'track', bpm: 160, steps: 160,
    tracks: [
      track({ name: 'Gallop Kick', instrument: 'bossHit', rangeLow: 48, rangeHigh: 60, steps: 160,
        events: everyN(160, 8, 48) }),
      track({ name: 'Fanfare', instrument: 'sawLead', rangeLow: 60, rangeHigh: 79, steps: 160,
        events: [
          ...repeatPattern(128, 32, [
            [0, 72], [2, 72], [4, 67], [6, 72], [8, 72], [10, 67], [12, 72], [14, 76],
            [16, 72], [18, 72], [20, 67], [22, 72], [24, 72], [26, 67], [28, 72], [30, 76],
          ]),
          [128, 72], [130, 72], [132, 67], [134, 72], [136, 72], [138, 67], [140, 72], [142, 79],
          [144, 72], [146, 72], [148, 67], [150, 72], [152, [72, 76, 79]],
        ] }),
    ],
  }),

  demo({
    id: 'toccata-fugue',
    label: 'Toccata and Fugue in D minor (Public Domain)',
    description: 'The dramatic opening flourish, repeated four times with a lower and fuller final chord — Johann Sebastian Bach, c. 1704 (public domain).',
    category: 'public-domain', length: 'track', bpm: 100, steps: 128,
    tracks: [
      track({ name: 'Flourish', instrument: 'fmBell', rangeLow: 50, rangeHigh: 81, steps: 128,
        events: [
          ...repeatPattern(96, 32, [
            [0, 81], [1, 79], [2, 81], [3, 77], [4, 74], [5, 72], [6, 69], [7, 67], [8, 65],
            [12, [50, 53, 57, 62]],
            [16, 81], [17, 79], [18, 81], [19, 77], [20, 74], [21, 72], [22, 69], [23, 67], [24, 65],
            [28, [50, 53, 57, 62]],
          ]),
          [96, 81], [97, 79], [98, 81], [99, 77], [100, 74], [101, 72], [102, 69], [103, 67], [104, 65],
          [105, 62], [106, 60], [107, 57], [108, 55],
          [112, [50, 53, 57, 62, 65]],
        ] }),
    ],
  }),

  demo({
    id: 'flight-of-bumblebee',
    label: 'Flight of the Bumblebee (Public Domain)',
    description: 'The frantic chromatic run repeated four times, alternating register each pass — Nikolai Rimsky-Korsakov, 1900 (public domain).',
    category: 'public-domain', length: 'track', bpm: 180, steps: 128,
    tracks: [
      track({ name: 'Run', instrument: 'sawLead', rangeLow: 55, rangeHigh: 77, steps: 128,
        events: [
          ...Array.from({ length: 13 }, (_, i) => [i, 60 + i]),
          ...Array.from({ length: 12 }, (_, i) => [13 + i, 71 - i]),
          ...Array.from({ length: 13 }, (_, i) => [32 + i, 55 + i]),
          ...Array.from({ length: 12 }, (_, i) => [45 + i, 66 - i]),
          ...Array.from({ length: 13 }, (_, i) => [64 + i, 65 + i]),
          ...Array.from({ length: 12 }, (_, i) => [77 + i, 76 - i]),
          ...Array.from({ length: 13 }, (_, i) => [96 + i, 60 + i]),
          ...Array.from({ length: 12 }, (_, i) => [109 + i, 71 - i]),
        ] }),
    ],
  }),

  demo({
    id: 'canon-in-d',
    label: 'Canon in D (Public Domain)',
    description: "The iconic ground-bass ostinato under a simplified fragment of the famous violin melody — Johann Pachelbel, c. 1680 (public domain).",
    category: 'public-domain', length: 'track', bpm: 96, steps: 160,
    tracks: [
      track({ name: 'Ground Bass', instrument: 'bass', volume: -8, rangeLow: 48, rangeHigh: 60, steps: 160,
        events: repeatPattern(160, 32, [[0, 50], [4, 57], [8, 59], [12, 54], [16, 55], [20, 50], [24, 55], [28, 57]]) }),
      track({ name: 'Melody', instrument: 'sineLead', volume: -6, rangeLow: 60, rangeHigh: 78, steps: 160,
        events: [
          ...shift([[0, 78], [8, 76], [16, 74], [24, 73], [32, 71], [40, 69], [48, 71], [56, 73]], 32),
          ...shift([[0, 74], [8, 73], [16, 71], [24, 69], [32, 67], [40, 69], [48, 71], [56, 73]], 96),
        ] }),
    ],
  }),

  demo({
    id: 'greensleeves',
    label: 'Greensleeves (Public Domain)',
    description: 'A folk melody in a minor/dorian mode over a drone, repeated three times — traditional English, 16th century (public domain).',
    category: 'public-domain', length: 'track', bpm: 90, steps: 96,
    tracks: [
      track({ name: 'Drone', instrument: 'subBass', volume: -12, rangeLow: 48, rangeHigh: 57, steps: 96,
        events: everyN(96, 16, 57) }),
      track({ name: 'Melody', instrument: 'fmBell', volume: -6, rangeLow: 60, rangeHigh: 77, steps: 96,
        events: repeatPattern(96, 32, [
          [0, 69], [2, 72], [4, 74], [6, 76], [8, 77], [10, 76], [12, 74], [14, 71],
          [16, 69], [18, 67], [20, 69],
        ]) }),
    ],
  }),

  demo({
    id: 'turkish-march',
    label: 'Rondo Alla Turca / Turkish March (Public Domain)',
    description: 'Simplified fast, playful A-minor theme repeated four times — Wolfgang Amadeus Mozart, 1783 (public domain).',
    category: 'public-domain', length: 'track', bpm: 152, steps: 128,
    tracks: [
      track({ name: 'Theme', instrument: 'squareLead', rangeLow: 60, rangeHigh: 81, steps: 128,
        events: repeatPattern(128, 16, [
          [0, 81], [1, 80], [2, 81], [3, 76], [4, 74], [5, 72], [6, 74], [7, 76],
          [8, 81], [9, 80], [10, 81], [11, 79], [12, 77], [13, 76], [14, 74], [15, 72],
        ]) }),
    ],
  }),

  demo({
    id: 'also-sprach-zarathustra',
    label: 'Also Sprach Zarathustra — Sunrise Fanfare (Public Domain)',
    description: 'The iconic drone-fanfare-timpani-chord "sunrise" opening, played twice — Richard Strauss, 1896 (public domain).',
    category: 'public-domain', length: 'track', bpm: 60, steps: 128,
    tracks: [
      track({ name: 'Drone', instrument: 'subBass', volume: -8, rangeLow: 48, rangeHigh: 55, steps: 128,
        events: everyN(128, 32, 48) }),
      track({ name: 'Fanfare', instrument: 'fmBell', rangeLow: 60, rangeHigh: 72, steps: 128,
        events: repeatPattern(128, 64, [[16, 60], [24, 67], [32, 72]]) }),
      track({ name: 'Timpani', instrument: 'bossHit', volume: -4, rangeLow: 48, rangeHigh: 60, steps: 128,
        events: repeatPattern(128, 64, [[36, 48], [40, 48], [44, 48]]) }),
      track({ name: 'Big Chord', instrument: 'trianglePad', rangeLow: 48, rangeHigh: 72, steps: 128,
        events: repeatPattern(128, 64, [[48, [48, 60, 64, 67, 72]]]) }),
    ],
  }),

  demo({
    id: 'fate-motif',
    label: 'Symphony No. 5 — "Fate" Motif (Public Domain)',
    description: 'The famous four-note "short-short-short-long" motif, repeated and sequenced down a step — Ludwig van Beethoven, 1808 (public domain).',
    category: 'public-domain', length: 'track', bpm: 108, steps: 128,
    tracks: [
      track({ name: 'Motif', instrument: 'sawLead', rangeLow: 55, rangeHigh: 70, steps: 128,
        events: repeatPattern(128, 32, [
          [0, 67], [2, 67], [4, 67], [6, 63],
          [16, 65], [18, 65], [20, 65], [22, 62],
        ]) }),
      track({ name: 'Impact', instrument: 'bossHit', volume: -6, rangeLow: 48, rangeHigh: 55, steps: 128,
        events: repeatPattern(128, 32, [[6, 48], [22, 48]]) }),
    ],
  }),

  demo({
    id: 'sugar-plum-fairy',
    label: 'Dance of the Sugar Plum Fairy (Public Domain)',
    description: 'The sparkling celesta-style descending-ascending figure, repeated six times — Pyotr Ilyich Tchaikovsky, 1892 (public domain).',
    category: 'public-domain', length: 'track', bpm: 110, steps: 96,
    tracks: [
      track({ name: 'Celesta', instrument: 'fmBell', rangeLow: 60, rangeHigh: 83, steps: 96,
        events: repeatPattern(96, 16, [
          [0, 83], [1, 81], [2, 79], [3, 77], [4, 74], [6, 71], [8, 74], [10, 77], [12, 79], [14, 83],
        ]) }),
    ],
  }),
];
