import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  soundSubmit, soundInvalid, soundSolve, soundOpponentSolve,
  soundTick, soundRoundEnd, soundWin, soundLose,
} from '../synth'

// ─── Minimal AudioContext mock ────────────────────────────────────────────────

function makeOscillator() {
  return {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    type: 'sine' as OscillatorType,
    frequency: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
  }
}

function makeGain() {
  return {
    connect: vi.fn(),
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  }
}

function makeCtx() {
  const osc  = makeOscillator()
  const gain = makeGain()
  return {
    createOscillator: vi.fn(() => osc),
    createGain:       vi.fn(() => gain),
    destination:      {},
    currentTime:      0,
    _osc:  osc,
    _gain: gain,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expectSoundPlayed(ctx: ReturnType<typeof makeCtx>) {
  expect(ctx.createOscillator).toHaveBeenCalled()
  expect(ctx.createGain).toHaveBeenCalled()
  expect(ctx._osc.connect).toHaveBeenCalledWith(ctx._gain)
  expect(ctx._gain.connect).toHaveBeenCalledWith(ctx.destination)
  expect(ctx._osc.start).toHaveBeenCalled()
  expect(ctx._osc.stop).toHaveBeenCalled()
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('soundSubmit', () => {
  it('plays a single-note tone', () => {
    const ctx = makeCtx()
    soundSubmit(ctx as any)
    expectSoundPlayed(ctx)
  })
})

describe('soundInvalid', () => {
  it('plays a sawtooth tone with frequency glide', () => {
    const ctx = makeCtx()
    soundInvalid(ctx as any)
    expectSoundPlayed(ctx)
    expect(ctx._osc.type).toBe('sawtooth')
    expect(ctx._osc.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(110, expect.any(Number))
  })
})

describe('soundSolve', () => {
  it('plays 3 notes (C5 E5 G5)', () => {
    const ctx = makeCtx()
    soundSolve(ctx as any)
    // 3 oscillators created
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3)
    expect(ctx.createGain).toHaveBeenCalledTimes(3)
  })
})

describe('soundOpponentSolve', () => {
  it('plays a quiet single-note tone', () => {
    const ctx = makeCtx()
    soundOpponentSolve(ctx as any)
    expectSoundPlayed(ctx)
    // volume should be subtle — gain set to 0.12
    expect(ctx._gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.12, expect.any(Number))
  })
})

describe('soundRoundEnd', () => {
  it('plays 2 notes', () => {
    const ctx = makeCtx()
    soundRoundEnd(ctx as any)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2)
  })
})

describe('soundWin', () => {
  it('plays 4 ascending notes', () => {
    const ctx = makeCtx()
    soundWin(ctx as any)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4)
  })
})

describe('soundLose', () => {
  it('plays 3 descending notes', () => {
    const ctx = makeCtx()
    soundLose(ctx as any)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3)
  })
})

describe('soundTick', () => {
  it('plays at each defined threshold', () => {
    const thresholds = [60, 30, 10, 5, 4, 3, 2, 1]
    for (const t of thresholds) {
      const ctx = makeCtx()
      soundTick(ctx as any, t)
      expectSoundPlayed(ctx)
    }
  })

  it('does nothing for undefined thresholds', () => {
    const ctx = makeCtx()
    soundTick(ctx as any, 45)
    expect(ctx.createOscillator).not.toHaveBeenCalled()
  })

  it('uses square oscillator for urgency thresholds (≤10s)', () => {
    const ctx = makeCtx()
    soundTick(ctx as any, 5)
    expect(ctx._osc.type).toBe('square')
  })

  it('uses sine oscillator for early thresholds (60s, 30s)', () => {
    const ctx = makeCtx()
    soundTick(ctx as any, 60)
    expect(ctx._osc.type).toBe('sine')
  })

  it('increases frequency as time runs out', () => {
    const freqs: number[] = []
    for (const t of [10, 5, 4, 3, 2, 1]) {
      const ctx = makeCtx()
      soundTick(ctx as any, t)
      // frequency is set via setValueAtTime(freq, time) — capture first call's first arg
      const firstCall = ctx._osc.frequency.setValueAtTime.mock.calls[0]
      freqs.push(firstCall[0] as number)
    }
    // Each tick should have a higher frequency than the previous
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i]).toBeGreaterThan(freqs[i - 1])
    }
  })
})
