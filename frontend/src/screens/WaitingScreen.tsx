import { useState } from 'react'
import type { PlayerInfo } from '../types'

interface WaitingScreenProps {
  code: string
  playerName: string
  players: PlayerInfo[]
  maxPlayers: number
  roundDuration: number
  isPublic: boolean
  roomName: string
  isHost: boolean
  onDeleteRoom: () => void
}

export function WaitingScreen({
  code, playerName, players, maxPlayers, roundDuration,
  isPublic, roomName, isHost, onDeleteRoom,
}: WaitingScreenProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [confirming, setConfirming] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied('code')
    setTimeout(() => setCopied(null), 2000)
  }

  const copyLink = () => {
    const url = `${location.origin}${location.pathname}?room=${code}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied('link')
    setTimeout(() => setCopied(null), 2000)
  }

  const handleDeleteClick = () => {
    if (!confirming) { setConfirming(true); return }
    onDeleteRoom()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
      <h1 className="text-4xl font-bold tracking-[0.3em]">TERMO</h1>

      {isPublic && roomName && (
        <p className="text-base font-semibold" style={{ color: '#c4b5b9' }}>{roomName}</p>
      )}

      <div className="text-center">
        <p className="text-sm mb-5" style={{ color: '#8a7880' }}>
          {isPublic ? 'Compartilhe com os adversários' : 'Compartilhe com os adversários'}
        </p>
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-5xl sm:text-6xl font-bold tracking-[0.35em]">{code}</span>
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={copyCode}
            className="btn-outline"
            style={{ width: 'auto', padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
          >
            {copied === 'code' ? '✓ Copiado' : 'Copiar código'}
          </button>
          <button
            onClick={copyLink}
            className="btn-outline"
            style={{ width: 'auto', padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
          >
            {copied === 'link' ? '✓ Copiado' : 'Compartilhar link'}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-bold" style={{ color: 'var(--color-right)' }}>
          {players.length}/{maxPlayers} jogadores
        </p>
        <p className="text-xs" style={{ color: '#8a7880' }}>
          {roundDuration} {roundDuration === 1 ? 'minuto' : 'minutos'} por rodada
        </p>
        <div className="flex flex-col gap-1 items-center">
          {players.map(p => (
            <span key={p.name} className="text-xs" style={{ color: p.name === playerName ? 'var(--color-text)' : '#8a7880' }}>
              {p.name === playerName ? `${p.name} (você)` : p.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3" style={{ color: '#8a7880' }}>
        <div
          className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{ borderColor: '#4c4347', borderTopColor: '#8a7880' }}
        />
        <span className="text-sm">Aguardando jogadores...</span>
      </div>

      {isHost && (
        <button
          onClick={handleDeleteClick}
          onBlur={() => setConfirming(false)}
          className="text-sm"
          style={{
            background: 'none', border: '1px solid #5a3038', borderRadius: '0.375rem',
            color: confirming ? '#c97070' : '#8a7880', cursor: 'pointer',
            padding: '0.375rem 1rem',
          }}
        >
          {confirming ? 'Confirmar exclusão?' : 'Excluir sala'}
        </button>
      )}
    </div>
  )
}
