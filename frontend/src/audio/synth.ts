// Web Audio API synthesis — pure functions, no side effects beyond the AudioContext passed in.

interface ToneOpts {
  frequencies: number[]  // one per note in sequence
  type: OscillatorType
  noteDuration: number   // ms per note
  volume?: number        // 0–1, default 0.3
  gap?: number           // ms silence between notes, default 15
  freqEnd?: number       // if set, glide frequency from frequencies[0] to freqEnd
}

function playTone(ctx: AudioContext, opts: ToneOpts): void {
  const { frequencies, type, noteDuration, volume = 0.3, gap = 15, freqEnd } = opts
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
    if (freqEnd !== undefined && i === frequencies.length - 1) {
      osc.frequency.linearRampToValueAtTime(freqEnd, t1)
    }

    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.005)
    gain.gain.setValueAtTime(volume, t1 - 0.01)
    gain.gain.linearRampToValueAtTime(0, t1)

    osc.start(t0)
    osc.stop(t1 + 0.01)
  })
}

// ENTER key pressed
export function soundSubmit(ctx: AudioContext): void {
  playTone(ctx, { frequencies: [600], type: 'sine', noteDuration: 55, volume: 0.22 })
}

// Word not in dictionary / invalid
export function soundInvalid(ctx: AudioContext): void {
  playTone(ctx, {
    frequencies: [220],
    type: 'sawtooth',
    noteDuration: 320,
    volume: 0.28,
    freqEnd: 110,
  })
}

// Player solved the word
export function soundSolve(ctx: AudioContext): void {
  playTone(ctx, {
    frequencies: [523, 659, 784],   // C5 E5 G5
    type: 'sine',
    noteDuration: 80,
    volume: 0.32,
    gap: 20,
  })
}

// Opponent solved the word (subtle)
export function soundOpponentSolve(ctx: AudioContext): void {
  playTone(ctx, { frequencies: [440], type: 'sine', noteDuration: 200, volume: 0.12 })
}

// Round ended
export function soundRoundEnd(ctx: AudioContext): void {
  playTone(ctx, {
    frequencies: [523, 659],  // C5 E5
    type: 'sine',
    noteDuration: 180,
    volume: 0.26,
    gap: 30,
  })
}

// Match won
export function soundWin(ctx: AudioContext): void {
  playTone(ctx, {
    frequencies: [523, 659, 784, 1047],  // C5 E5 G5 C6
    type: 'sine',
    noteDuration: 110,
    volume: 0.35,
    gap: 25,
  })
}

// Match lost
export function soundLose(ctx: AudioContext): void {
  playTone(ctx, {
    frequencies: [262, 220, 175],  // C4 A3 F3
    type: 'sine',
    noteDuration: 180,
    volume: 0.28,
    gap: 20,
  })
}

// Timer threshold tick — frequency and volume scale with urgency
export function soundTick(ctx: AudioContext, secondsLeft: number): void {
  const map: Record<number, { freq: number; vol: number; dur: number; type: OscillatorType }> = {
    60: { freq: 880, vol: 0.18, dur: 280, type: 'sine'   },
    30: { freq: 880, vol: 0.25, dur: 280, type: 'sine'   },
    10: { freq: 440, vol: 0.28, dur:  90, type: 'square' },
     5: { freq: 520, vol: 0.32, dur:  90, type: 'square' },
     4: { freq: 600, vol: 0.35, dur: 100, type: 'square' },
     3: { freq: 680, vol: 0.37, dur: 100, type: 'square' },
     2: { freq: 760, vol: 0.38, dur: 100, type: 'square' },
     1: { freq: 840, vol: 0.40, dur: 110, type: 'square' },
  }
  const cfg = map[secondsLeft]
  if (!cfg) return
  playTone(ctx, { frequencies: [cfg.freq], type: cfg.type, noteDuration: cfg.dur, volume: cfg.vol })
}
