import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const wordsDir = join(process.cwd(), 'words')

function loadArray(file: string): string[] {
  const path = join(wordsDir, file)
  if (!existsSync(path)) {
    throw new Error(`Word list not found at ${path}. Run: pnpm run prepare-words`)
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

let _valid: Set<string> | null = null
let _answers: string[] | null = null

export function getValidWords(): Set<string> {
  if (!_valid) _valid = new Set(loadArray('valid.json'))
  return _valid
}

export function getAnswerPool(): string[] {
  if (!_answers) _answers = loadArray('answers.json')
  return _answers
}

export function isValidGuess(word: string): boolean {
  return getValidWords().has(word)
}

export function pickRandomWord(): string {
  const pool = getAnswerPool()
  return pool[Math.floor(Math.random() * pool.length)]
}
