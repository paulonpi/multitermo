import type { MatchEndData, PlayerInfo } from '../types'

interface MatchEndScreenProps {
  data: MatchEndData
  myName: string
  players: PlayerInfo[]
  onPlayAgain: () => void
}

export function MatchEndScreen({ data, myName, players, onPlayAgain }: MatchEndScreenProps) {
  const { winnerName, scores } = data

  const resultMessage =
    winnerName === myName ? 'Você venceu o duelo!' :
    winnerName === null   ? 'Empate!' :
    `${winnerName} venceu o duelo.`

  const resultColor =
    winnerName === myName ? 'var(--color-right)' :
    winnerName === null   ? 'var(--color-place)' :
    '#8a7880'

  const maxScore = Math.max(...players.map(p => scores[p.name] ?? 0))

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 p-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#8a7880' }}>Fim de Jogo</p>
        <p className="text-3xl font-bold" style={{ color: resultColor }}>{resultMessage}</p>
      </div>

      <div className="flex items-end gap-5 sm:gap-8 flex-wrap justify-center">
        {players.map(p => {
          const score = scores[p.name] ?? 0
          const isWinner = score === maxScore && winnerName !== null
          return (
            <div key={p.name} className="flex flex-col items-center gap-1">
              <span
                className="text-4xl sm:text-5xl font-bold"
                style={{ color: isWinner ? 'var(--color-text)' : '#8a7880' }}
              >
                {score}
              </span>
              <span
                className="text-sm"
                style={{ color: p.name === myName ? '#c4b2b8' : '#4c4347' }}
              >
                {p.name}
              </span>
            </div>
          )
        })}
      </div>

      <button onClick={onPlayAgain} className="btn-primary" style={{ width: 'auto', padding: '0.75rem 2rem' }}>
        Jogar Novamente
      </button>
    </div>
  )
}
