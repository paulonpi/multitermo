import type { TileState } from '../types'

/* Layout matches term.ooo: qwertyuiop / asdfghjkl / [enter] zxcvbnm [⌫] */
const ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
]

const PRIORITY: Record<TileState, number> = { correct: 3, present: 2, absent: 1 }

function computeLetterStates(guesses: string[], results: TileState[][]): Record<string, TileState> {
  const states: Record<string, TileState> = {}
  for (let i = 0; i < guesses.length; i++) {
    for (let j = 0; j < guesses[i].length; j++) {
      const letter = guesses[i][j].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      const s = results[i]?.[j]
      if (s && (!states[letter] || PRIORITY[s] > PRIORITY[states[letter]])) {
        states[letter] = s
      }
    }
  }
  return states
}

const STATE_CLASS: Record<TileState, string> = {
  correct: 'kbd-right',
  present: 'kbd-place',
  absent:  'kbd-wrong',
}

interface KeyboardProps {
  guesses: string[]
  results: TileState[][]
  onKey: (key: string) => void
}

export function Keyboard({ guesses, results, onKey }: KeyboardProps) {
  const letterStates = computeLetterStates(guesses, results)

  return (
    <div className="flex flex-col items-center gap-1.5">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-1.5">
          {row.map(key => {
            const isWide = key === 'ENTER' || key === '⌫'
            const ls = !isWide ? letterStates[key] : undefined
            const stateClass = ls ? STATE_CLASS[ls] : ''

            return (
              <button
                key={key}
                onClick={() => onKey(key === '⌫' ? 'BACKSPACE' : key)}
                className={`kbd-key ${isWide ? 'kbd-key-wide' : 'kbd-key-letter'} ${stateClass}`}
              >
                {key}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
