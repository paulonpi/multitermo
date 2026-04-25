// Web Audio API synthesis — pure functions, no side effects beyond the AudioContext passed in.

interface ToneOpts {
  frequencies: number[]  // one per note in sequence
  type?: OscillatorType  // default 'sine'
  noteDuration: number   // ms per note
  volume?: number        // 0–1, default 0.15
  gap?: number           // ms silence between notes, default 20
}

function playTone(ctx: AudioContext, opts: ToneOpts): void {
  const { frequencies, type = 'sine', noteDuration, volume = 0.15, gap = 20 } = opts
  const now = ctx.currentTime
  const noteSec = noteDuration / 1000
  const gapSec  = gap / 1000

  frequencies.forEach((freq, i) => {
    const t0 = now + i * (noteSec + gapSec)
    const t1 = t0 + noteSec

    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)

    // Instant attack, exponential decay — natural chime-like envelope
    gain.gain.setValueAtTime(volume, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t1)

    osc.start(t0)
    osc.stop(t1 + 0.01)
  })
}

// ENTER key pressed — soft, short click
export function soundSubmit(ctx: AudioContext): void {
  playTone(ctx, { frequencies: [300], noteDuration: 35, volume: 0.09 })
}

// Word not in dictionary — two low thumps (no harsh buzz)
export function soundInvalid(ctx: AudioContext): void {
  playTone(ctx, { frequencies: [200, 160], noteDuration: 80, volume: 0.13, gap: 45 })
}

// Player solved the word — gentle two-note chime
export function soundSolve(ctx: AudioContext): void {
  playTone(ctx, { frequencies: [523, 784], noteDuration: 100, volume: 0.14, gap: 35 })
}

// Opponent solved the word — barely perceptible ping
export function soundOpponentSolve(ctx: AudioContext): void {
  playTone(ctx, { frequencies: [392], noteDuration: 130, volume: 0.07 })
}

// Round ended — soft two-note close
export function soundRoundEnd(ctx: AudioContext): void {
  playTone(ctx, { frequencies: [440, 523], noteDuration: 150, volume: 0.12, gap: 40 })
}

// Match won — soft three-note ascending chime
export function soundWin(ctx: AudioContext): void {
  playTone(ctx, { frequencies: [523, 659, 784], noteDuration: 100, volume: 0.14, gap: 30 })
}

// Match lost — two descending notes
export function soundLose(ctx: AudioContext): void {
  playTone(ctx, { frequencies: [330, 262], noteDuration: 140, volume: 0.10, gap: 35 })
}

// Timer threshold tick — all sine, very subtle, gentle escalation only at last seconds
export function soundTick(ctx: AudioContext, secondsLeft: number): void {
  const map: Record<number, { freq: number; vol: number; dur: number }> = {
    60: { freq: 480, vol: 0.06, dur: 50 },
    30: { freq: 480, vol: 0.08, dur: 50 },
    10: { freq: 440, vol: 0.09, dur: 40 },
     5: { freq: 480, vol: 0.10, dur: 40 },
     4: { freq: 520, vol: 0.11, dur: 45 },
     3: { freq: 560, vol: 0.12, dur: 45 },
     2: { freq: 600, vol: 0.13, dur: 45 },
     1: { freq: 640, vol: 0.14, dur: 50 },
  }
  const cfg = map[secondsLeft]
  if (!cfg) return
  playTone(ctx, { frequencies: [cfg.freq], noteDuration: cfg.dur, volume: cfg.vol })
}
