import type { PlayerInfo } from '../types'

interface ScoreHeaderProps {
  round: number
  totalRounds: number
  players: PlayerInfo[]
  myName: string
}

export function ScoreHeader({ round, totalRounds, players, myName }: ScoreHeaderProps) {
  const [p0, p1] = players

  return (
    <div className="flex items-center justify-between w-full px-4 py-2 text-sm" style={{ borderBottom: '1px solid #4c4347' }}>
      <span style={{ color: '#8a7880' }}>
        Rodada <span className="font-bold" style={{ color: 'var(--color-text)' }}>{round}/{totalRounds}</span>
      </span>
      <div className="flex items-center gap-3 font-bold">
        <span style={{ color: p0?.name === myName ? 'var(--color-text)' : '#8a7880' }}>
          {p0?.name}: {p0?.score ?? 0}
        </span>
        <span style={{ color: '#4c4347' }}>×</span>
        <span style={{ color: p1?.name === myName ? 'var(--color-text)' : '#8a7880' }}>
          {p1?.score ?? 0} :{p1?.name}
        </span>
      </div>
    </div>
  )
}
