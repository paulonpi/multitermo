import { TileState } from '../types'

export function evaluateGuess(guess: string, answer: string): TileState[] {
  const result: TileState[] = Array(5).fill('absent')
  const answerArr = answer.split('')
  const guessArr = guess.split('')

  // First pass: correct positions
  for (let i = 0; i < 5; i++) {
    if (guessArr[i] === answerArr[i]) {
      result[i] = 'correct'
      answerArr[i] = '\0'
      guessArr[i] = '\0'
    }
  }

  // Second pass: present but wrong position
  for (let i = 0; i < 5; i++) {
    if (guessArr[i] === '\0') continue
    const j = answerArr.indexOf(guessArr[i])
    if (j !== -1) {
      result[i] = 'present'
      answerArr[j] = '\0'
    }
  }

  return result
}

// Returns [maxGreens, maxYellows] of the best single attempt
export function bestAttemptScore(results: TileState[][]): [number, number] {
  let maxGreens = 0, maxYellows = 0
  for (const row of results) {
    const greens  = row.filter(t => t === 'correct').length
    const yellows = row.filter(t => t === 'present').length
    if (greens > maxGreens || (greens === maxGreens && yellows > maxYellows)) {
      maxGreens = greens; maxYellows = yellows
    }
  }
  return [maxGreens, maxYellows]
}

export function normalize(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
