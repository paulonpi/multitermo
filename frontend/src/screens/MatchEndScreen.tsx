import { useState } from 'react'
import type { MatchEndData, PlayerInfo } from '../types'
import { encodePayload, buildShareText } from '../utils/share'
import type { SharePayload } from '../utils/share'

interface MatchEndScreenProps {
  data: MatchEndData
  myName: string
  players: PlayerInfo[]
  onPlayAgain: () => void
}

export function MatchEndScreen({ data, myName, players, onPlayAgain }: MatchEndScreenProps) {
  const [shareLabel, setShareLabel] = useState<string | null>(null)
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
  const totalRounds = maxScore > 0 ? Math.max(...Object.values(scores)) + Math.min(...Object.values(scores)) : 5

  const canShare = winnerName === myName || winnerName === null

  const handleShare = async () => {
    const sorted = [...players]
      .map(p => ({ n: p.name, r: scores[p.name] ?? 0 }))
      .sort((a, b) => b.r - a.r)
    const payload: SharePayload = { w: winnerName, s: sorted, t: totalRounds }
    const encoded = encodePayload(payload)
    const baseUrl = `${location.origin}`
    const shareUrl = `${baseUrl}/share?d=${encoded}`
    const text = buildShareText(payload, shareUrl)

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Termo Multiplayer', text, url: shareUrl })
        return
      } catch {
        // fall through to clipboard
      }
    }

    navigator.clipboard.writeText(shareUrl).catch(() => {})
    setShareLabel('Link copiado!')
    setTimeout(() => setShareLabel(null), 2000)
  }

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

      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        {canShare && (
          <button
            onClick={handleShare}
            className="btn-outline w-full"
            style={{ fontSize: '0.875rem' }}
          >
            {shareLabel ?? 'Compartilhar resultado'}
          </button>
        )}
        <button onClick={onPlayAgain} className="btn-primary w-full">
          Jogar Novamente
        </button>
      </div>
    </div>
  )
}
