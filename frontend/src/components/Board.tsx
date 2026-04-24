import { Tile } from './Tile'
import type { TileState, TileStatus } from '../types'

interface BoardProps {
  guesses: string[]
  results: TileState[][]
  currentLetters: string[]
  cursorPos: number
  shakeRow: boolean
}

export function Board({ guesses, results, currentLetters, cursorPos, shakeRow }: BoardProps) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 6 }, (_, row) => {
        const isSubmitted = row < guesses.length
        const isCurrent   = row === guesses.length

        return (
          <div
            key={row}
            className={`flex gap-1 ${isCurrent && shakeRow ? 'row-shake' : ''}`}
          >
            {Array.from({ length: 5 }, (_, col) => {
              let letter: string
              let tileState: TileStatus

              if (isSubmitted) {
                letter    = guesses[row][col] ?? ''
                tileState = results[row][col]
              } else if (isCurrent) {
                letter    = currentLetters[col] ?? ''
                tileState = letter ? 'input' : 'empty'
              } else {
                letter    = ''
                tileState = 'empty'
              }

              return (
                <Tile
                  key={col}
                  letter={letter.toUpperCase()}
                  state={tileState}
                  animateFlip={isSubmitted}
                  flipDelay={col * 275}
                  isCursor={isCurrent && col === cursorPos}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
