// Procedural background music for Shadow Clone Survivor.
// Uses the Web Audio API so no external assets are needed.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let schedulerId: number | null = null;
let nextNoteTime = 0;
let step = 0;
let running = false;

// Epic minor progression (Am - F - C - G), arpeggio + bass + lead.
// Notes in MIDI numbers.
const BASS: number[] = [33, 33, 29, 31]; // A1, A1, F1, G1 per bar
const CHORDS: number[][] = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];
const LEAD: number[] = [
  69, 72, 76, 72, 69, 72, 76, 79,
  65, 69, 72, 69, 65, 69, 72, 76,
  60, 64, 67, 64, 60, 64, 67, 72,
  62, 67, 71, 67, 62, 67, 71, 74,
];

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

function scheduleStep(s: number, time: number) {
  const bar = Math.floor(s / 16) % 4;
  const beatIn16 = s % 16;

  // Bass on every quarter note
  if (beatIn16 % 4 === 0) {
    playNote(midiToFreq(BASS[bar]), time, SIXTEENTH * 3.8, "triangle", 0.32);
  }
  // Chord pad on downbeat of each bar
  if (beatIn16 === 0) {
    for (const n of CHORDS[bar]) {
      playNote(midiToFreq(n), time, SIXTEENTH * 14, "sawtooth", 0.05);
    }
  }
  // Lead arpeggio every 16th
  const leadNote = LEAD[(bar * 8 + (beatIn16 % 8)) % LEAD.length];
  playNote(midiToFreq(leadNote), time, SIXTEENTH * 0.9, "square", 0.07);

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
