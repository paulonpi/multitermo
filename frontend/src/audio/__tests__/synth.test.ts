import { describe, it, expect, vi } from 'vitest'
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
  it('plays two low sine tones', () => {
    const ctx = makeCtx()
    soundInvalid(ctx as any)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2)
    expect(ctx.createGain).toHaveBeenCalledTimes(2)
    expect(ctx._osc.type).toBe('sine')
  })
})

describe('soundSolve', () => {
  it('plays 2 notes (C5 G5)', () => {
    const ctx = makeCtx()
    soundSolve(ctx as any)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2)
    expect(ctx.createGain).toHaveBeenCalledTimes(2)
  })
})

describe('soundOpponentSolve', () => {
  it('plays a quiet single-note tone', () => {
    const ctx = makeCtx()
    soundOpponentSolve(ctx as any)
    expectSoundPlayed(ctx)
    expect(ctx._gain.gain.setValueAtTime).toHaveBeenCalledWith(0.07, expect.any(Number))
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
  it('plays 3 ascending notes', () => {
    const ctx = makeCtx()
    soundWin(ctx as any)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3)
  })
})

describe('soundLose', () => {
  it('plays 2 descending notes', () => {
    const ctx = makeCtx()
    soundLose(ctx as any)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2)
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

  it('uses sine oscillator for all thresholds', () => {
    for (const t of [60, 30, 10, 5, 4, 3, 2, 1]) {
      const ctx = makeCtx()
      soundTick(ctx as any, t)
      expect(ctx._osc.type).toBe('sine')
    }
  })

  it('increases frequency as time runs out', () => {
    const freqs: number[] = []
    for (const t of [10, 5, 4, 3, 2, 1]) {
      const ctx = makeCtx()
      soundTick(ctx as any, t)
      const firstCall = ctx._osc.frequency.setValueAtTime.mock.calls[0]
      freqs.push(firstCall[0] as number)
    }
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i]).toBeGreaterThan(freqs[i - 1])
    }
  })
})
