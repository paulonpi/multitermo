import type { PlayerInfo } from '../types'

interface ScoreHeaderProps {
  round: number
  totalRounds: number
  players: PlayerInfo[]
  myName: string
  muted: boolean
  onToggleMute: () => void
}

export function ScoreHeader({ round, totalRounds, players, myName, muted, onToggleMute }: ScoreHeaderProps) {
  return (
    <div className="flex items-center justify-between w-full px-4 py-2 text-sm" style={{ borderBottom: '1px solid #4c4347' }}>
      <span style={{ color: '#8a7880' }}>
        Rodada <span className="font-bold" style={{ color: 'var(--color-text)' }}>{round}/{totalRounds}</span>
      </span>
      <div className="flex items-center gap-2 flex-wrap justify-end font-bold">
        {players.map((p, i) => (
          <span key={p.name} style={{ color: p.name === myName ? 'var(--color-text)' : '#8a7880' }}>
            {i > 0 && <span className="mr-2" style={{ color: '#4c4347' }}>·</span>}
            {p.name}: {p.score}
          </span>
        ))}
      </div>
      <button
        onClick={onToggleMute}
        aria-label={muted ? 'Ativar som' : 'Silenciar'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, opacity: muted ? 0.45 : 1 }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  )
}
