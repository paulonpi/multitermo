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

// Generate inflected forms (plurals) from a set of base words.
// Only produces results that are exactly 5 letters.
function generateInflections(baseWords: Set<string>): Set<string> {
  const result = new Set<string>()
  for (const word of baseWords) {
    // 4-letter base ending in vowel \u2192 add -s (sapo\u2192sapos, mesa\u2192mesas, gato\u2192gatos)
    if (word.length === 4 && /[aeiou]$/.test(word)) {
      result.add(word + 's')
    }
    // 4-letter base ending in -m \u2192 replace with -ns (bom\u2192bons, som\u2192sons)
    else if (word.length === 4 && word.endsWith('m')) {
      result.add(word.slice(0, -1) + 'ns')
    }
    // 3-letter base ending in -r or -z \u2192 add -es (mar\u2192mares, luz\u2192luzes, paz\u2192pazes)
    else if (word.length === 3 && /[rz]$/.test(word)) {
      result.add(word + 'es')
    }
  }
  return result
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

  // Build display map + lexico sets from lexico
  // lexicoValid: 5-letter words for valid guesses
  // lexicoAll:   all words (any length) for inflection generation
  const displayMap: Record<string, string> = {}
  const lexicoValid = new Set<string>()
  const lexicoAll   = new Set<string>()
  for (const line of lexicoText.split('\n')) {
    const original = line.trim().toLowerCase()
    if (!original) continue
    const norm = normalize(original)
    if (!/^[a-z]+$/.test(norm)) continue
    lexicoAll.add(norm)
    if (norm.length !== 5) continue
    lexicoValid.add(norm)
    if (!displayMap[norm]) {
      displayMap[norm] = original
    } else if (displayMap[norm] === norm && original !== norm) {
      displayMap[norm] = original  // upgrade to accented form
    }
  }

  // Build answer pool from ICF (frequency corpus — common, well-known words)
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
  // Generate inflected forms (plurals, etc.) from all lexico words
  const inflected = generateInflections(lexicoAll)

  // valid = lexico + ICF + inflected forms from lexico
  const allValid = new Set([...lexicoValid, ...icfWords.keys(), ...inflected])
  const valid    = [...allValid].sort()
  const answers  = valid.filter(w =>
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
