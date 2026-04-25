import { useRef, useState, useCallback } from 'react'
import {
  soundSubmit, soundInvalid, soundSolve, soundOpponentSolve,
  soundTick, soundRoundEnd, soundWin, soundLose,
} from './synth'

const STORAGE_KEY = 'termo:muted'

function loadMuted(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}

function saveMuted(v: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, String(v)) } catch { /* ignore */ }
}

export interface SoundMap {
  onSubmit:        () => void
  onInvalid:       () => void
  onSolve:         () => void
  onOpponentSolve: () => void
  onTick:          (secondsLeft: number) => void
  onRoundEnd:      () => void
  onWin:           () => void
  onLose:          () => void
}

export function useSounds(): { sounds: SoundMap; muted: boolean; toggleMute: () => void } {
  const ctxRef  = useRef<AudioContext | null>(null)
  const [muted, setMuted] = useState(loadMuted)

  // Lazily create (or resume) the AudioContext — must happen inside a user gesture
  const getCtx = useCallback((): AudioContext | null => {
    if (muted) return null
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext()
      }
      if (ctxRef.current.state === 'suspended') {
        ctxRef.current.resume()
      }
      return ctxRef.current
    } catch {
      return null
    }
  }, [muted])

  const play = useCallback((fn: (ctx: AudioContext) => void) => {
    const ctx = getCtx()
    if (ctx) fn(ctx)
  }, [getCtx])

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      saveMuted(next)
      return next
    })
  }, [])

  const sounds: SoundMap = {
    onSubmit:        () => play(soundSubmit),
    onInvalid:       () => play(soundInvalid),
    onSolve:         () => play(soundSolve),
    onOpponentSolve: () => play(soundOpponentSolve),
    onTick:          (s) => play(ctx => soundTick(ctx, s)),
    onRoundEnd:      () => play(soundRoundEnd),
    onWin:           () => play(soundWin),
    onLose:          () => play(soundLose),
  }

  return { sounds, muted, toggleMute }
}
