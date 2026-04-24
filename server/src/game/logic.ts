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

export function countCorrectTiles(results: TileState[][]): number {
  return results.reduce((sum, row) => sum + row.filter(t => t === 'correct').length, 0)
}

export function normalize(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
