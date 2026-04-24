import { writeFileSync, mkdirSync, existsSync } from 'fs'
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

  // Build ICF score map: normalized → lowest score
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

  // Build display map: normalized → original with accents
  // Prefers the accented form over the plain form
  const displayMap: Record<string, string> = {}
  for (const line of lexicoText.split('\n')) {
    const original = line.trim().toLowerCase()
    if (!original) continue
    const norm = normalize(original)
    if (norm.length !== 5 || !/^[a-z]+$/.test(norm)) continue
    if (!displayMap[norm]) {
      displayMap[norm] = original                  // first form found
    } else if (displayMap[norm] === norm && original !== norm) {
      displayMap[norm] = original                  // upgrade to accented
    }
  }

  const valid   = Object.keys(displayMap).sort()
  const answers = valid.filter(w => {
    const score = icfScores.get(w)
    return score !== undefined && score < ICF_ANSWER_THRESHOLD
  })

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
