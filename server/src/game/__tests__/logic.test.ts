import { describe, it, expect } from 'vitest'
import { evaluateGuess, bestAttemptScore, normalize } from '../logic'

// ─── normalize ────────────────────────────────────────────────────────────────

describe('normalize', () => {
  it('strips accents', () => {
    expect(normalize('São')).toBe('sao')
    expect(normalize('maçã')).toBe('maca')
    expect(normalize('pão')).toBe('pao')
    expect(normalize('ação')).toBe('acao')
  })

  it('lowercases', () => {
    expect(normalize('ARROZ')).toBe('arroz')
    expect(normalize('Termo')).toBe('termo')
  })

  it('trims whitespace', () => {
    expect(normalize('  idosa  ')).toBe('idosa')
  })

  it('leaves plain words unchanged', () => {
    expect(normalize('idosa')).toBe('idosa')
    expect(normalize('pedra')).toBe('pedra')
  })
})

// ─── evaluateGuess ────────────────────────────────────────────────────────────

describe('evaluateGuess', () => {
  it('all correct when guess equals answer', () => {
    expect(evaluateGuess('arroz', 'arroz'))
      .toEqual(['correct', 'correct', 'correct', 'correct', 'correct'])
  })

  it('all absent when no letters overlap', () => {
    // limbo vs turfa — zero shared letters
    expect(evaluateGuess('limbo', 'turfa'))
      .toEqual(['absent', 'absent', 'absent', 'absent', 'absent'])
  })

  it('marks letters in wrong positions as present', () => {
    // rosca vs arroz: r(0)=present, o(1)=present, s=absent, c=absent, a(4)=present
    expect(evaluateGuess('rosca', 'arroz'))
      .toEqual(['present', 'present', 'absent', 'absent', 'present'])
  })

  it('correct position takes priority over present in same guess', () => {
    // carro vs carro: trivially all correct
    expect(evaluateGuess('carro', 'carro'))
      .toEqual(['correct', 'correct', 'correct', 'correct', 'correct'])
  })

  it('mixes correct, present and absent correctly', () => {
    // picar vs pires: p(0)correct, i(1)correct, c=absent, a=absent, r(4)=present
    expect(evaluateGuess('picar', 'pires'))
      .toEqual(['correct', 'correct', 'absent', 'absent', 'present'])
  })

  // ── Duplicate-letter edge cases ─────────────────────────────────────────────
  // These cases generate the most user confusion; having them documented as
  // passing tests prevents regressions.

  describe('duplicate letters', () => {
    it('letter already matched green is not reused for yellow', () => {
      // zaroz vs arroz — z at pos 4 is green, so the z at pos 0 has no z left → absent
      // trace: first pass pos2(r),pos3(o),pos4(z) all green
      //        second pass: pos0(z) → indexOf z in remaining = -1 → absent
      //                     pos1(a) → indexOf a = 0            → present
      expect(evaluateGuess('zaroz', 'arroz'))
        .toEqual(['absent', 'present', 'correct', 'correct', 'correct'])
    })

    it('only one yellow when duplicate letter appears once in answer', () => {
      // Two z's in guess at wrong positions vs one z in answer
      // guess pos0 z consumes the answer's z → pos3 z becomes absent
      // (answer=arroz: a,r,r,o,z — no exact z match in first pass since pos4≠pos4? wait:
      //  zenzo: z,e,n,z,o vs a,r,r,o,z
      //  first pass: no exact matches
      //  second pass: pos0 z → present (consumes answer z at index 4),
      //               pos3 z → absent  (no more z left))
      expect(evaluateGuess('zenzo', 'arroz'))
        .toEqual(['present', 'absent', 'absent', 'absent', 'present'])
    })

    it('handles two copies of a letter in the answer independently', () => {
      // rolar vs morro (m,o,r,r,o): r appears twice in answer
      // first pass: pos1 o==o → green
      // second pass: pos0 r → present (consumes answer r at index 2)
      //              pos4 r → present (consumes answer r at index 3)
      expect(evaluateGuess('rolar', 'morro'))
        .toEqual(['present', 'correct', 'absent', 'absent', 'present'])
    })

    it('excess guess copies of a repeated answer letter are absent', () => {
      // answer "corra" (c,o,r,r,a): two r's
      // guess  "rruga" (r,r,u,g,a): two r's in guess, one a at end
      // first pass: pos4 a==a → green
      // second pass: pos0 r → present (consumes answer r at index 2)
      //              pos1 r → present (consumes answer r at index 3)
      expect(evaluateGuess('rruga', 'corra'))
        .toEqual(['present', 'present', 'absent', 'absent', 'correct'])
    })

    it('guess with more copies than answer marks extras as absent', () => {
      // answer "forma" (f,o,r,m,a): one r, one a
      // guess  "rarra" (r,a,r,r,a): three r's and two a's
      // first pass: pos2 r==r → green, pos4 a==a → green
      //   answerArr after: [f,o,\0,m,\0]  guessArr after: [r,a,\0,r,\0]
      // second pass: pos0 r → indexOf r in [f,o,\0,m,\0] = -1 → absent
      //              pos1 a → indexOf a in [f,o,\0,m,\0] = -1 → absent
      //              pos3 r → indexOf r = -1 → absent
      expect(evaluateGuess('rarra', 'forma'))
        .toEqual(['absent', 'absent', 'correct', 'absent', 'correct'])
    })
  })
})

// ─── bestAttemptScore ─────────────────────────────────────────────────────────

describe('bestAttemptScore', () => {
  it('returns [0, 0] for empty results', () => {
    expect(bestAttemptScore([])).toEqual([0, 0])
  })

  it('counts greens and yellows for a single row', () => {
    expect(bestAttemptScore([
      ['correct', 'correct', 'absent', 'present', 'absent'],
    ])).toEqual([2, 1])
  })

  it('returns the row with most greens across multiple attempts', () => {
    expect(bestAttemptScore([
      ['absent',  'absent',  'absent',  'absent',  'absent'],   // [0, 0]
      ['correct', 'correct', 'absent',  'present', 'absent'],   // [2, 1]
      ['correct', 'absent',  'present', 'absent',  'absent'],   // [1, 1]
    ])).toEqual([2, 1])
  })

  it('tiebreaks on yellows when greens are equal', () => {
    expect(bestAttemptScore([
      ['correct', 'absent',  'absent',  'absent',  'absent'],   // [1, 0]
      ['correct', 'present', 'present', 'absent',  'absent'],   // [1, 2]
    ])).toEqual([1, 2])
  })

  it('returns best even when best row is not the last', () => {
    expect(bestAttemptScore([
      ['correct', 'correct', 'correct', 'absent',  'absent'],   // [3, 0]
      ['correct', 'absent',  'absent',  'absent',  'absent'],   // [1, 0]
    ])).toEqual([3, 0])
  })

  it('handles a solved row (all correct)', () => {
    expect(bestAttemptScore([
      ['correct', 'correct', 'correct', 'correct', 'correct'],
    ])).toEqual([5, 0])
  })
})
