import { Tile } from '../components/Tile'
import type { RoundEndData, PlayerInfo } from '../types'

interface RoundEndScreenProps {
  data: RoundEndData
  myName: string
  players: PlayerInfo[]
}

export function RoundEndScreen({ data, myName, players }: RoundEndScreenProps) {
  const { round, word, winnerName, scores, playerResults } = data
  const opponent = players.find(p => p.name !== myName)
  const myResult = playerResults[myName]
  const opponentResult = opponent ? playerResults[opponent.name] : null

  const resultMessage =
    winnerName === myName ? 'Você venceu esta rodada!' :
    winnerName === null   ? 'Empate!' :
    `${winnerName} venceu.`

  const subtitle = data.timedOut ? 'Tempo esgotado!' : `Rodada ${round}`

  const resultColor =
    winnerName === myName ? 'var(--color-right)' :
    winnerName === null   ? 'var(--color-place)' :
    '#8a7880'

  return (
    <div className="flex flex-col items-center min-h-screen gap-6 p-4 pt-10 overflow-y-auto">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#8a7880' }}>{subtitle}</p>
        <p className="text-xl font-bold" style={{ color: resultColor }}>{resultMessage}</p>
      </div>

      <div className="text-center">
        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#8a7880' }}>A palavra era</p>
        <div className="flex gap-1 justify-center">
          {word.split('').map((letter, i) => (
            <Tile key={i} letter={letter.toUpperCase()} state="correct" />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm font-bold">
        {players.map((p, i) => (
          <span key={p.name} style={{ color: p.name === myName ? 'var(--color-text)' : '#8a7880' }}>
            {i === 1 && <span className="mr-6" style={{ color: '#4c4347' }}>×</span>}
            {p.name}: {scores[p.name] ?? 0}
          </span>
        ))}
      </div>

      <div className="flex gap-8 mt-2 flex-wrap justify-center">
        {myResult && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs mb-1 uppercase tracking-wider" style={{ color: '#8a7880' }}>{myName}</p>
            {myResult.guesses.map((guess, row) => (
              <div key={row} className="flex gap-1">
                {guess.split('').map((letter, col) => (
                  <Tile key={col} letter={letter.toUpperCase()} state={myResult.results[row][col]} size="small" />
                ))}
              </div>
            ))}
            {!myResult.solved && (
              <p className="text-xs mt-1" style={{ color: '#4c4347' }}>não acertou</p>
            )}
          </div>
        )}

        {opponentResult && opponent && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs mb-1 uppercase tracking-wider" style={{ color: '#8a7880' }}>{opponent.name}</p>
            {opponentResult.guesses.map((guess, row) => (
              <div key={row} className="flex gap-1">
                {guess.split('').map((letter, col) => (
                  <Tile key={col} letter={letter.toUpperCase()} state={opponentResult.results[row][col]} size="small" />
                ))}
              </div>
            ))}
            {!opponentResult.solved && (
              <p className="text-xs mt-1" style={{ color: '#4c4347' }}>não acertou</p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs animate-pulse mt-2" style={{ color: '#4c4347' }}>Próxima rodada em breve...</p>
    </div>
  )
}
