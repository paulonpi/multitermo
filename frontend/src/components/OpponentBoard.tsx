import { Tile } from './Tile'
import type { TileState, TileStatus } from '../types'
import type { OpponentAttempt } from '../hooks/useGame'

interface OpponentBoardProps {
  attempts: OpponentAttempt[]
  done: boolean
}

export function OpponentBoard({ attempts, done }: OpponentBoardProps) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 6 }, (_, row) => {
        const attempt = attempts[row] as OpponentAttempt | undefined

        return (
          <div key={row} className="flex gap-1">
            {Array.from({ length: 5 }, (_, col) => {
              const tileState: TileStatus = attempt
                ? (attempt.result[col] as TileState)
                : 'empty'

              return (
                <Tile
                  key={col}
                  letter=""
                  state={tileState}
                  size="small"
                  animateFlip={!!attempt}
                  flipDelay={col * 150}
                />
              )
            })}
          </div>
        )
      })}
      {done && (
        <p className="text-xs text-center mt-1" style={{ color: '#8a7880' }}>terminou</p>
      )}
    </div>
  )
}
