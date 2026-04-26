import { useState } from 'react'
import { Tile } from '../components/Tile'
import type { MatchEndData, PlayerInfo, RoundHistoryEntry } from '../types'
import { encodePayload, buildShareText } from '../utils/share'
import type { SharePayload } from '../utils/share'

interface MatchEndScreenProps {
  data: MatchEndData
  myName: string
  players: PlayerInfo[]
  onPlayAgain: () => void
}

function RoundHistoryItem({ entry, myName, players }: { entry: RoundHistoryEntry; myName: string; players: PlayerInfo[] }) {
  const [open, setOpen] = useState(false)

  const headerColor =
    entry.winnerName === myName ? 'var(--color-right)' :
    entry.winnerName === null   ? 'var(--color-place)' :
    '#8a7880'

  const winnerLabel = entry.winnerName === null ? 'Empate' : entry.winnerName

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid #3d2f34', background: '#2a1e22' }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-3 text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#8a7880', minWidth: '4.5rem' }}>
            Rodada {entry.round}
          </span>
          <div className="flex gap-0.5">
            {entry.word.split('').map((l, i) => (
              <Tile key={i} letter={l.toUpperCase()} state="correct" size="small" />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: headerColor }}>{winnerLabel}</span>
          <span style={{ color: '#4c4347', fontSize: '0.7rem' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="flex gap-4 px-3 pb-4 pt-1 justify-center flex-wrap">
          {players.map(p => {
            const res = entry.playerResults[p.name]
            if (!res) return null
            return (
              <div key={p.name} className="flex flex-col items-center gap-1">
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: p.name === myName ? '#c4b5b9' : '#8a7880' }}>
                  {p.name}
                </p>
                {res.guesses.map((guess, row) => (
                  <div key={row} className="flex gap-0.5">
                    {guess.split('').map((letter, col) => (
                      <Tile key={col} letter={letter.toUpperCase()} state={res.results[row][col]} size="small" />
                    ))}
                  </div>
                ))}
                {!res.solved && (
                  <p className="text-xs mt-1" style={{ color: '#4c4347' }}>não acertou</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MatchEndScreen({ data, myName, players, onPlayAgain }: MatchEndScreenProps) {
  const [shareLabel, setShareLabel] = useState<string | null>(null)
  const { winnerName, scores, rounds = [] } = data

  const resultMessage =
    winnerName === myName ? 'Você venceu o duelo!' :
    winnerName === null   ? 'Empate!' :
    `${winnerName} venceu o duelo.`

  const resultColor =
    winnerName === myName ? 'var(--color-right)' :
    winnerName === null   ? 'var(--color-place)' :
    '#8a7880'

  const maxScore = Math.max(...players.map(p => scores[p.name] ?? 0))
  const totalRounds = rounds.length || 5

  const canShare = winnerName === myName || winnerName === null

  const handleShare = async () => {
    const sorted = [...players]
      .map(p => ({ n: p.name, r: scores[p.name] ?? 0 }))
      .sort((a, b) => b.r - a.r)
    const payload: SharePayload = { w: winnerName, s: sorted, t: totalRounds }
    const encoded = encodePayload(payload)
    const shareUrl = `${location.origin}/share?d=${encoded}`
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
    <div className="flex flex-col items-center min-h-screen gap-8 p-4 pb-10 max-w-sm mx-auto">

      <div className="text-center pt-6">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#8a7880' }}>Fim de Jogo</p>
        <p className="text-3xl font-bold" style={{ color: resultColor }}>{resultMessage}</p>
      </div>

      <div className="flex items-end gap-5 sm:gap-8 flex-wrap justify-center">
        {players.map(p => {
          const score = scores[p.name] ?? 0
          const isWinner = score === maxScore && winnerName !== null
          return (
            <div key={p.name} className="flex flex-col items-center gap-1">
              <span className="text-4xl sm:text-5xl font-bold" style={{ color: isWinner ? 'var(--color-text)' : '#8a7880' }}>
                {score}
              </span>
              <span className="text-sm" style={{ color: p.name === myName ? '#c4b2b8' : '#4c4347' }}>
                {p.name}
              </span>
            </div>
          )
        })}
      </div>

      {rounds.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          <p className="text-xs uppercase tracking-widest text-center mb-1" style={{ color: '#8a7880' }}>
            Histórico
          </p>
          {rounds.map(entry => (
            <RoundHistoryItem key={entry.round} entry={entry} myName={myName} players={players} />
          ))}
        </div>
      )}

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
