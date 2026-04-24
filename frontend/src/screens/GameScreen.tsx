import { useEffect } from 'react'
import { Board } from '../components/Board'
import { OpponentBoard } from '../components/OpponentBoard'
import { Keyboard } from '../components/Keyboard'
import { ScoreHeader } from '../components/ScoreHeader'
import { Toast } from '../components/Toast'
import type { GameState } from '../hooks/useGame'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface GameScreenProps {
  state: GameState
  onKeyPress: (key: string) => void
}

export function GameScreen({ state, onKeyPress }: GameScreenProps) {
  const {
    players, myName, currentRound, totalRounds,
    guesses, results, currentLetters, cursorPos, shakeRow,
    opponentAttempts, opponentDone, toast, myDone, timeLeft,
  } = state

  const opponent = players.find(p => p.name !== myName)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Enter') onKeyPress('ENTER')
      else if (e.key === 'Backspace') onKeyPress('BACKSPACE')
      else if (e.key === 'ArrowLeft') { e.preventDefault(); onKeyPress('ARROWLEFT') }
      else if (e.key === 'ArrowRight') { e.preventDefault(); onKeyPress('ARROWRIGHT') }
      else if (/^[a-zA-Z]$/.test(e.key)) onKeyPress(e.key.toUpperCase())
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onKeyPress])

  return (
    <div className="flex flex-col items-center min-h-screen">
      <header className="w-full max-w-2xl">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #4c4347' }}>
          <div className="w-16" />
          <h1 className="text-xl font-bold tracking-[0.25em]">TERMO</h1>
          <div className="w-16 text-right">
            {timeLeft >= 0 && (
              <span
                className="font-bold tabular-nums text-sm"
                style={{ color: timeLeft <= 30 ? 'var(--color-place)' : 'var(--color-text)' }}
              >
                {formatTime(timeLeft)}
              </span>
            )}
          </div>
        </div>
        <ScoreHeader
          round={currentRound}
          totalRounds={totalRounds}
          players={players}
          myName={myName}
        />
      </header>

      <Toast message={toast} />

      <main className="flex flex-1 gap-6 md:gap-10 p-4 justify-center items-start mt-4">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-widest" style={{ color: '#8a7880' }}>
            {myName} {myDone && '✓'}
          </span>
          <Board
            guesses={guesses}
            results={results}
            currentLetters={currentLetters}
            cursorPos={cursorPos}
            shakeRow={shakeRow}
          />
        </div>

        {opponent && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-widest" style={{ color: '#8a7880' }}>
              {opponent.name} {opponentDone && '✓'}
            </span>
            <OpponentBoard attempts={opponentAttempts} done={opponentDone} />
          </div>
        )}
      </main>

      <footer className="w-full max-w-lg px-2 pb-4">
        <Keyboard guesses={guesses} results={results} onKey={onKeyPress} />
      </footer>
    </div>
  )
}
