import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

const ICF_ANSWER_THRESHOLD = 13

function normalize(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.text()
}

async function main() {
  const wordsDir = join(process.cwd(), 'words')

  if (existsSync(join(wordsDir, 'valid.json'))) {
    console.log('Word list already exists, skipping download.')
    return
  }

  console.log('Downloading lexico + icf from fserb/pt-br...')
  const [lexicoText, icfText] = await Promise.all([
    fetchText('https://raw.githubusercontent.com/fserb/pt-br/master/lexico'),
    fetchText('https://raw.githubusercontent.com/fserb/pt-br/master/icf'),
  ])

  // Build display map from lexico: normalized → original with accents
  // Prefers the accented form if the same normalized word appears twice
  const displayMap: Record<string, string> = {}
  for (const line of lexicoText.split('\n')) {
    const original = line.trim().toLowerCase()
    if (!original) continue
    const norm = normalize(original)
    if (norm.length !== 5 || !/^[a-z]+$/.test(norm)) continue
    if (!displayMap[norm]) {
      displayMap[norm] = original
    } else if (displayMap[norm] === norm && original !== norm) {
      displayMap[norm] = original  // upgrade to accented form
    }
  }

  // Build valid + answer pools from ICF (includes all inflected forms and conjugations)
  const icfWords = new Map<string, number>()  // normalized → lowest score
  for (const line of icfText.split('\n')) {
    const comma = line.lastIndexOf(',')
    if (comma === -1) continue
    const word  = normalize(line.slice(0, comma))
    const score = parseFloat(line.slice(comma + 1))
    if (!word || isNaN(score) || word.length !== 5 || !/^[a-z]+$/.test(word)) continue
    const prev = icfWords.get(word)
    if (prev === undefined || score < prev) icfWords.set(word, score)
  }

  // Merge supplement words (manually curated common words missing from ICF)
  const supplementPath = join(process.cwd(), 'words-supplement.json')
  if (existsSync(supplementPath)) {
    const supplementRaw: string[] = JSON.parse(readFileSync(supplementPath, 'utf-8'))
    for (const entry of supplementRaw) {
      const norm = normalize(entry)
      if (norm.length !== 5 || !/^[a-z]+$/.test(norm)) continue
      if (!icfWords.has(norm)) icfWords.set(norm, 0)  // score 0 = always an answer
      const original = entry.trim().toLowerCase()
      if (!displayMap[norm]) displayMap[norm] = original
      else if (displayMap[norm] === norm && original !== norm) displayMap[norm] = original
    }
    console.log(`Merged ${supplementRaw.length} supplement entries.`)
  }

  const FOREIGN_CHARS = /[kwy]/
  const valid   = [...icfWords.keys()].sort()
  const answers = valid.filter(w =>
    (icfWords.get(w) ?? Infinity) < ICF_ANSWER_THRESHOLD && !FOREIGN_CHARS.test(w)
  )

  // Fill display map with identity for ICF words not in lexico
  for (const w of valid) {
    if (!displayMap[w]) displayMap[w] = w
  }

  mkdirSync(wordsDir, { recursive: true })
  writeFileSync(join(wordsDir, 'valid.json'),   JSON.stringify(valid))
  writeFileSync(join(wordsDir, 'answers.json'), JSON.stringify(answers))
  writeFileSync(join(wordsDir, 'display.json'), JSON.stringify(displayMap))

  console.log(`Done: ${answers.length} answer words, ${valid.length} valid guesses.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
