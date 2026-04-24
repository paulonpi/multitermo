import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const ICF_ANSWER_THRESHOLD = 13  // lower score = more common; ~1900 words below this

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

  // Build ICF score map: normalized word → lowest score seen
  // (multiple accented variants can normalize to the same word)
  const icfScores = new Map<string, number>()
  for (const line of icfText.split('\n')) {
    const comma = line.lastIndexOf(',')
    if (comma === -1) continue
    const word  = normalize(line.slice(0, comma))
    const score = parseFloat(line.slice(comma + 1))
    if (!word || isNaN(score)) continue
    const prev = icfScores.get(word)
    if (prev === undefined || score < prev) icfScores.set(word, score)
  }

  // Valid guesses: all 5-letter a-z words from lexico
  const allWords = lexicoText
    .split('\n')
    .map(l => normalize(l))
    .filter(w => w.length === 5 && /^[a-z]+$/.test(w))

  const valid   = [...new Set(allWords)].sort()

  // Answer pool: only words with ICF score below threshold
  const answers = valid.filter(w => {
    const score = icfScores.get(w)
    return score !== undefined && score < ICF_ANSWER_THRESHOLD
  })

  mkdirSync(wordsDir, { recursive: true })
  writeFileSync(join(wordsDir, 'valid.json'),   JSON.stringify(valid))
  writeFileSync(join(wordsDir, 'answers.json'), JSON.stringify(answers))

  console.log(`Done: ${answers.length} answer words, ${valid.length} valid guesses.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
