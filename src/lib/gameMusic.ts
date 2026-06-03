// Procedural background music for Shadow Clone Survivor.
// Uses the Web Audio API so no external assets are needed.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let schedulerId: number | null = null;
let nextNoteTime = 0;
let step = 0;
let running = false;
let musicStartTime = 0;

const SWITCH_INTERVAL = 180; // seconds — change track every 3 minutes

interface Track {
  bass: number[];
  chords: number[][];
  lead: number[];
  leadType: OscillatorType;
  padType: OscillatorType;
  leadGain: number;
  padGain: number;
}

// Track 0 — Epic Minor (Am – F – C – G)
const TRACK0: Track = {
  bass: [33, 33, 29, 31],
  chords: [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [55, 59, 62],
  ],
  lead: [
    69, 72, 76, 72, 69, 72, 76, 79,
    65, 69, 72, 69, 65, 69, 72, 76,
    60, 64, 67, 64, 60, 64, 67, 72,
    62, 67, 71, 67, 62, 67, 71, 74,
  ],
  leadType: "square",
  padType: "sawtooth",
  leadGain: 0.07,
  padGain: 0.05,
};

// Track 1 — Dark Tension (Dm – Bb – F – C)
const TRACK1: Track = {
  bass: [26, 26, 29, 24],
  chords: [
    [50, 53, 57],
    [46, 50, 53],
    [41, 45, 48],
    [48, 52, 55],
  ],
  lead: [
    62, 65, 69, 65, 62, 65, 69, 72,
    58, 62, 65, 62, 58, 62, 65, 69,
    53, 57, 60, 57, 53, 57, 60, 65,
    55, 60, 64, 60, 55, 60, 64, 67,
  ],
  leadType: "sawtooth",
  padType: "triangle",
  leadGain: 0.08,
  padGain: 0.06,
};

// Track 2 — Heroic Major (Em – C – G – D)
const TRACK2: Track = {
  bass: [28, 28, 31, 26],
  chords: [
    [52, 55, 59],
    [48, 52, 55],
    [55, 59, 62],
    [50, 54, 57],
  ],
  lead: [
    64, 67, 71, 67, 64, 67, 71, 74,
    60, 64, 67, 64, 60, 64, 67, 71,
    55, 59, 62, 59, 55, 59, 62, 67,
    57, 62, 66, 62, 57, 62, 66, 69,
  ],
  leadType: "square",
  padType: "sawtooth",
  leadGain: 0.08,
  padGain: 0.05,
};

// Track 3 — Mystic March (Fm – Db – Ab – Eb)
const TRACK3: Track = {
  bass: [29, 29, 32, 27],
  chords: [
    [53, 56, 60],
    [49, 53, 56],
    [44, 48, 51],
    [51, 55, 58],
  ],
  lead: [
    65, 68, 72, 68, 65, 68, 72, 75,
    61, 65, 68, 65, 61, 65, 68, 72,
    56, 60, 63, 60, 56, 60, 63, 68,
    58, 63, 67, 63, 58, 63, 67, 70,
  ],
  leadType: "triangle",
  padType: "sawtooth",
  leadGain: 0.09,
  padGain: 0.055,
};

// Track 4 — Neon Pursuit (Em – Bm – G – D)
const TRACK4: Track = {
  bass: [28, 23, 31, 26],
  chords: [
    [52, 55, 59],
    [47, 50, 54],
    [55, 59, 62],
    [50, 54, 57],
  ],
  lead: [
    64, 67, 71, 74, 71, 67, 64, 67,
    59, 62, 66, 69, 66, 62, 59, 62,
    62, 67, 71, 74, 71, 67, 62, 67,
    57, 62, 66, 69, 66, 62, 57, 62,
  ],
  leadType: "sawtooth",
  padType: "square",
  leadGain: 0.075,
  padGain: 0.05,
};

// Track 5 — Boss Rage (Cm – Gm – Ab – Bb)
const TRACK5: Track = {
  bass: [24, 31, 32, 22],
  chords: [
    [48, 51, 55],
    [43, 46, 50],
    [44, 48, 51],
    [46, 50, 53],
  ],
  lead: [
    60, 63, 67, 70, 67, 63, 60, 63,
    55, 58, 62, 65, 62, 58, 55, 58,
    56, 60, 63, 68, 63, 60, 56, 60,
    58, 62, 65, 70, 65, 62, 58, 62,
  ],
  leadType: "square",
  padType: "sawtooth",
  leadGain: 0.09,
  padGain: 0.06,
};

// Track 6 — Crystal Dream (Gm – Eb – Bb – F)
const TRACK6: Track = {
  bass: [31, 27, 22, 29],
  chords: [
    [55, 58, 62],
    [51, 55, 58],
    [46, 50, 53],
    [53, 57, 60],
  ],
  lead: [
    67, 70, 74, 70, 67, 70, 74, 77,
    63, 67, 70, 67, 63, 67, 70, 74,
    58, 62, 65, 62, 58, 62, 65, 70,
    60, 65, 69, 65, 60, 65, 69, 72,
  ],
  leadType: "triangle",
  padType: "sine",
  leadGain: 0.075,
  padGain: 0.06,
};

// Track 7 — Shadow Hunt (Bm – G – D – A)
const TRACK7: Track = {
  bass: [23, 31, 26, 21],
  chords: [
    [47, 50, 54],
    [55, 59, 62],
    [50, 54, 57],
    [45, 49, 52],
  ],
  lead: [
    59, 62, 66, 62, 59, 62, 66, 69,
    55, 59, 62, 59, 55, 59, 62, 66,
    50, 54, 57, 54, 50, 54, 57, 62,
    52, 57, 61, 57, 52, 57, 61, 64,
  ],
  leadType: "sawtooth",
  padType: "triangle",
  leadGain: 0.08,
  padGain: 0.055,
};

const TRACKS: Track[] = [TRACK0, TRACK1, TRACK2, TRACK3, TRACK4, TRACK5, TRACK6, TRACK7];
let forcedTrack: number | null = null;

const BPM = 110;
const SIXTEENTH = 60 / BPM / 4; // seconds per 16th note
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.1;

function midiToFreq(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function playNote(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gain: number,
) {
  if (!ctx || !masterGain) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(masterGain);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function getTrackAtTime(time: number): Track {
  if (forcedTrack !== null) return TRACKS[forcedTrack % TRACKS.length];
  const elapsed = Math.max(0, time - musicStartTime);
  const idx = Math.floor(elapsed / SWITCH_INTERVAL) % TRACKS.length;
  return TRACKS[idx];
}

export function setMusicTrack(idx: number | null) {
  forcedTrack = idx === null ? null : ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
  if (ctx) {
    musicStartTime = ctx.currentTime;
    step = 0;
  }
}

export function getTrackCount() {
  return TRACKS.length;
}

function scheduleStep(s: number, time: number) {
  const track = getTrackAtTime(time);
  const bar = Math.floor(s / 16) % 4;
  const beatIn16 = s % 16;

  // Bass on every quarter note
  if (beatIn16 % 4 === 0) {
    playNote(midiToFreq(track.bass[bar]), time, SIXTEENTH * 3.8, "triangle", 0.32);
  }
  // Chord pad on downbeat of each bar
  if (beatIn16 === 0) {
    for (const n of track.chords[bar]) {
      playNote(midiToFreq(n), time, SIXTEENTH * 14, track.padType, track.padGain);
    }
  }
  // Lead arpeggio every 16th
  const leadNote = track.lead[(bar * 8 + (beatIn16 % 8)) % track.lead.length];
  playNote(midiToFreq(leadNote), time, SIXTEENTH * 0.9, track.leadType, track.leadGain);

  // Kick on 1 and 3
  if (beatIn16 === 0 || beatIn16 === 8) {
    if (ctx && masterGain) {
      const k = ctx.createOscillator();
      const kg = ctx.createGain();
      k.frequency.setValueAtTime(120, time);
      k.frequency.exponentialRampToValueAtTime(40, time + 0.15);
      kg.gain.setValueAtTime(0.5, time);
      kg.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      k.connect(kg).connect(masterGain);
      k.start(time);
      k.stop(time + 0.2);
    }
  }
}

function tick() {
  if (!ctx || !running) return;
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextNoteTime);
    nextNoteTime += SIXTEENTH;
    step++;
  }
  schedulerId = window.setTimeout(tick, LOOKAHEAD_MS);
}

export function startMusic(volume = 0.35) {
  if (running) return;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
    } else {
      void ctx.resume();
      if (masterGain) masterGain.gain.value = volume;
    }
    running = true;
    step = 0;
    musicStartTime = ctx.currentTime;
    nextNoteTime = ctx.currentTime + 0.05;
    tick();
  } catch {
    running = false;
  }
}

export function stopMusic() {
  running = false;
  if (schedulerId !== null) {
    clearTimeout(schedulerId);
    schedulerId = null;
  }
  if (masterGain && ctx) {
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(0, now + 0.1);
    // Restore for next start
    window.setTimeout(() => {
      if (masterGain) masterGain.gain.value = 0.35;
    }, 200);
  }
}

export function setMusicVolume(v: number) {
  if (masterGain) masterGain.gain.value = v;
}

export function isMusicRunning() {
  return running;
}

export function playWave50Alarm() {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.35;
      masterGain.connect(ctx.destination);
    }
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const alarmGain = ctx.createGain();
    alarmGain.gain.setValueAtTime(0.25, now);
    alarmGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    alarmGain.connect(masterGain);
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, now + i * 0.25);
      osc.frequency.exponentialRampToValueAtTime(440, now + i * 0.25 + 0.12);
      osc.connect(alarmGain);
      osc.start(now + i * 0.25);
      osc.stop(now + i * 0.25 + 0.2);
    }
    // deep rumble underneath
    const rumble = ctx.createOscillator();
    rumble.type = "sine";
    rumble.frequency.setValueAtTime(60, now);
    rumble.frequency.exponentialRampToValueAtTime(30, now + 2.5);
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.15, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    rumbleGain.connect(masterGain);
    rumble.connect(rumbleGain);
    rumble.start(now);
    rumble.stop(now + 2.6);
  } catch {}
}

export function playWave75Alarm() {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.35;
      masterGain.connect(ctx.destination);
    }
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const alarmGain = ctx.createGain();
    alarmGain.gain.setValueAtTime(0.3, now);
    alarmGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
    alarmGain.connect(masterGain);
    for (let i = 0; i < 10; i++) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(1200, now + i * 0.2);
      osc.frequency.exponentialRampToValueAtTime(600, now + i * 0.2 + 0.1);
      osc.connect(alarmGain);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.15);
    }
    const rumble = ctx.createOscillator();
    rumble.type = "sawtooth";
    rumble.frequency.setValueAtTime(80, now);
    rumble.frequency.exponentialRampToValueAtTime(40, now + 3.5);
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.2, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
    rumbleGain.connect(masterGain);
    rumble.connect(rumbleGain);
    rumble.start(now);
    rumble.stop(now + 3.6);
  } catch {}
}
