import type { MatchEndData, PlayerInfo } from '../types'

interface MatchEndScreenProps {
  data: MatchEndData
  myName: string
  players: PlayerInfo[]
  onPlayAgain: () => void
}

export function MatchEndScreen({ data, myName, players, onPlayAgain }: MatchEndScreenProps) {
  const { winnerName, scores } = data
  const [p0, p1] = players

  const resultMessage =
    winnerName === myName ? 'Você venceu o duelo!' :
    winnerName === null   ? 'Empate!' :
    `${winnerName} venceu o duelo.`

  const resultColor =
    winnerName === myName ? 'var(--color-right)' :
    winnerName === null   ? 'var(--color-place)' :
    '#8a7880'

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 p-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#8a7880' }}>Fim de Jogo</p>
        <p className="text-3xl font-bold" style={{ color: resultColor }}>{resultMessage}</p>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <span
            className="text-5xl font-bold"
            style={{ color: p0?.name === myName ? 'var(--color-text)' : '#8a7880' }}
          >
            {scores[p0?.name ?? ''] ?? 0}
          </span>
          <span className="text-sm" style={{ color: p0?.name === myName ? '#c4b2b8' : '#4c4347' }}>
            {p0?.name}
          </span>
        </div>
        <span className="text-3xl" style={{ color: '#4c4347' }}>×</span>
        <div className="flex flex-col items-center gap-1">
          <span
            className="text-5xl font-bold"
            style={{ color: p1?.name === myName ? 'var(--color-text)' : '#8a7880' }}
          >
            {scores[p1?.name ?? ''] ?? 0}
          </span>
          <span className="text-sm" style={{ color: p1?.name === myName ? '#c4b2b8' : '#4c4347' }}>
            {p1?.name}
          </span>
        </div>
      </div>

      <button onClick={onPlayAgain} className="btn-primary" style={{ width: 'auto', padding: '0.75rem 2rem' }}>
        Jogar Novamente
      </button>
    </div>
  )
}
