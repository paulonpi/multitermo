import { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '../socket'
import { useSounds } from '../audio/useSounds'
import type { TileState, PlayerInfo, RoundEndData, MatchEndData, Screen } from '../types'

export interface OpponentAttempt {
  result: TileState[]
}

export interface GameState {
  screen: Screen
  roomCode: string
  myName: string
  players: PlayerInfo[]
  maxPlayers: number
  waitingPlayers: PlayerInfo[]
  currentRound: number
  totalRounds: number
  guesses: string[]
  results: TileState[][]
  currentLetters: string[]
  cursorPos: number
  opponentAttempts: Record<string, OpponentAttempt[]>
  opponentDone: Record<string, boolean>
  myDone: boolean
  shakeRow: boolean
  toast: string | null
  roundEndData: RoundEndData | null
  matchEndData: MatchEndData | null
  timeLeft: number  // seconds; -1 = no active timer
}

const EMPTY_LETTERS = ['', '', '', '', '']

const INITIAL: GameState = {
  screen: 'home',
  roomCode: '',
  myName: '',
  players: [],
  maxPlayers: 2,
  waitingPlayers: [],
  currentRound: 1,
  totalRounds: 5,
  guesses: [],
  results: [],
  currentLetters: EMPTY_LETTERS,
  cursorPos: 0,
  opponentAttempts: {},
  opponentDone: {},
  myDone: false,
  shakeRow: false,
  toast: null,
  roundEndData: null,
  matchEndData: null,
  timeLeft: -1,
}

function resetInput() {
  return { currentLetters: [...EMPTY_LETTERS], cursorPos: 0 }
}

export function useGame() {
  const [state, setState] = useState<GameState>(INITIAL)
  const stateRef = useRef(state)
  const roundEndTimeRef = useRef<number>(0)
  const hasConnectedRef = useRef(false)
  const timerSoundedRef = useRef(new Set<number>())
  const { sounds, muted, toggleMute } = useSounds()
  const soundsRef = useRef(sounds)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    soundsRef.current = sounds
  }, [sounds])

  // Countdown ticker — runs while on game screen
  const TIMER_THRESHOLDS = [60, 30, 10, 5, 4, 3, 2, 1]
  useEffect(() => {
    if (state.screen !== 'game') return
    const interval = setInterval(() => {
      const t = Math.max(0, Math.round((roundEndTimeRef.current - Date.now()) / 1000))
      setState(s => s.screen === 'game' ? { ...s, timeLeft: t } : s)
      for (const threshold of TIMER_THRESHOLDS) {
        if (t <= threshold && !timerSoundedRef.current.has(threshold)) {
          timerSoundedRef.current.add(threshold)
          sounds.onTick(threshold)
          break
        }
      }
    }, 500)
    return () => clearInterval(interval)
  }, [state.screen, state.currentRound, sounds])

  useEffect(() => {
    const socket = getSocket()

    socket.on('connect', () => {
      if (hasConnectedRef.current) {
        // Reconnect after network dropout — room is gone on the server, reset to home
        setState(s => s.screen !== 'home' ? { ...INITIAL, toast: 'Conexão perdida. Tente novamente.' } : s)
        setTimeout(() => setState(s => ({ ...s, toast: null })), 3000)
      }
      hasConnectedRef.current = true
    })

    socket.on('room_created', ({ code, maxPlayers }: { code: string; maxPlayers: number }) => {
      setState(s => ({
        ...s,
        screen: 'waiting',
        roomCode: code,
        maxPlayers,
        waitingPlayers: [{ name: s.myName, score: 0 }],
      }))
    })

    socket.on('room_joined', ({ code, maxPlayers, players }: { code: string; maxPlayers: number; players: PlayerInfo[] }) => {
      setState(s => ({
        ...s,
        screen: 'waiting',
        roomCode: code,
        maxPlayers,
        waitingPlayers: players,
      }))
    })

    socket.on('player_joined', ({ players, maxPlayers }: { players: PlayerInfo[]; maxPlayers: number }) => {
      setState(s => ({ ...s, waitingPlayers: players, maxPlayers }))
    })

    socket.on('game_start', ({ players }: { players: PlayerInfo[] }) => {
      setState(s => ({ ...s, screen: 'game', players }))
    })

    socket.on('round_start', ({ round, totalRounds, roundEndTime }: { round: number; totalRounds: number; roundEndTime: number }) => {
      roundEndTimeRef.current = roundEndTime
      timerSoundedRef.current = new Set()
      setState(s => ({
        ...s,
        screen: 'game',
        currentRound: round,
        totalRounds,
        guesses: [],
        results: [],
        ...resetInput(),
        opponentAttempts: {},
        opponentDone: {},
        myDone: false,
        shakeRow: false,
        toast: null,
        roundEndData: null,
        timeLeft: Math.round((roundEndTime - Date.now()) / 1000),
      }))
    })

    socket.on('guess_result', (data: {
      valid: boolean
      guess?: string
      result?: TileState[]
      solved?: boolean
      done?: boolean
      message?: string
    }) => {
      if (!data.valid) {
        soundsRef.current.onInvalid()
        setState(s => ({ ...s, shakeRow: true, toast: data.message ?? 'Palavra inválida.' }))
        setTimeout(() => setState(s => ({ ...s, shakeRow: false, toast: null })), 1500)
        return
      }
      if (data.solved) soundsRef.current.onSolve()
      setState(s => ({
        ...s,
        guesses: [...s.guesses, data.guess!],
        results: [...s.results, data.result!],
        ...resetInput(),
        myDone: data.done ?? false,
        toast: data.solved ? 'Você acertou!' : null,
      }))
      if (data.solved) {
        setTimeout(() => setState(s => ({ ...s, toast: null })), 1500)
      }
    })

    socket.on('opponent_progress', (data: { playerName: string; result: TileState[]; done: boolean; solved?: boolean }) => {
      if (data.done && data.solved) soundsRef.current.onOpponentSolve()
      setState(s => ({
        ...s,
        opponentAttempts: {
          ...s.opponentAttempts,
          [data.playerName]: [...(s.opponentAttempts[data.playerName] ?? []), { result: data.result }],
        },
        opponentDone: {
          ...s.opponentDone,
          [data.playerName]: data.done,
        },
      }))
    })

    socket.on('round_end', (data: RoundEndData) => {
      soundsRef.current.onRoundEnd()
      setState(s => ({
        ...s,
        screen: 'round_end',
        roundEndData: data,
        players: s.players.map(p => ({ ...p, score: data.scores[p.name] ?? p.score })),
      }))
    })

    socket.on('match_end', (data: MatchEndData) => {
      const myName = stateRef.current.myName
      if (data.winnerName === myName) soundsRef.current.onWin()
      else soundsRef.current.onLose()
      setState(s => ({ ...s, screen: 'match_end', matchEndData: data }))
    })

    socket.on('player_left', ({ playerName, players }: { playerName: string; players: PlayerInfo[] }) => {
      setState(s => ({
        ...s,
        players,
        waitingPlayers: players,
        toast: `${playerName} desconectou.`,
      }))
      setTimeout(() => setState(s => ({ ...s, toast: null })), 3000)
    })

    socket.on('opponent_disconnected', () => {
      setState(s => ({ ...s, toast: 'Adversário desconectou.' }))
      setTimeout(() => {
        getSocket().disconnect()
        setState(INITIAL)
      }, 3000)
    })

    socket.on('error', ({ message }: { message: string }) => {
      setState(s => ({ ...s, toast: message }))
      setTimeout(() => setState(s => ({ ...s, toast: null })), 2000)
    })

    return () => {
      socket.off('connect')
      socket.off('room_created')
      socket.off('room_joined')
      socket.off('player_joined')
      socket.off('game_start')
      socket.off('round_start')
      socket.off('guess_result')
      socket.off('opponent_progress')
      socket.off('round_end')
      socket.off('match_end')
      socket.off('player_left')
      socket.off('opponent_disconnected')
      socket.off('error')
    }
  }, [])

  const createRoom = useCallback((playerName: string, maxPlayers: number) => {
    setState(s => ({ ...s, myName: playerName }))
    getSocket().connect()
    getSocket().emit('create_room', { playerName, maxPlayers })
  }, [])

  const joinRoom = useCallback((code: string, playerName: string) => {
    setState(s => ({ ...s, myName: playerName }))
    getSocket().connect()
    getSocket().emit('join_room', { code, playerName })
    history.replaceState(null, '', location.pathname)
  }, [])

  const onKeyPress = useCallback((key: string) => {
    const s = stateRef.current
    if (s.screen !== 'game' || s.myDone) return

    if (key === 'ARROWLEFT') {
      setState(prev => ({ ...prev, cursorPos: Math.max(0, prev.cursorPos - 1) }))
      return
    }

    if (key === 'ARROWRIGHT') {
      setState(prev => ({ ...prev, cursorPos: Math.min(4, prev.cursorPos + 1) }))
      return
    }

    if (key.startsWith('CURSOR:')) {
      const col = parseInt(key.slice(7))
      if (col >= 0 && col <= 4) setState(prev => ({ ...prev, cursorPos: col }))
      return
    }

    if (key === 'BACKSPACE') {
      setState(prev => {
        const letters = [...prev.currentLetters]
        if (letters[prev.cursorPos] !== '') {
          letters[prev.cursorPos] = ''
          return { ...prev, currentLetters: letters }
        } else if (prev.cursorPos > 0) {
          letters[prev.cursorPos - 1] = ''
          return { ...prev, currentLetters: letters, cursorPos: prev.cursorPos - 1 }
        }
        return prev
      })
      return
    }

    if (key === 'ENTER') {
      soundsRef.current.onSubmit()
      if (s.currentLetters.every(l => l !== '')) {
        getSocket().emit('submit_guess', { guess: s.currentLetters.join('') })
      }
      return
    }

    if (/^[A-Z]$/.test(key)) {
      setState(prev => {
        const letters = [...prev.currentLetters]
        letters[prev.cursorPos] = key.toLowerCase()
        return {
          ...prev,
          currentLetters: letters,
          cursorPos: Math.min(4, prev.cursorPos + 1),
        }
      })
    }
  }, [])

  const playAgain = useCallback(() => {
    setState(INITIAL)
  }, [])

  const goToHowToPlay = useCallback((show: boolean) => {
    setState(s => ({ ...s, screen: show ? 'how_to_play' : 'home' }))
  }, [])

  return { state, createRoom, joinRoom, onKeyPress, playAgain, muted, toggleMute, goToHowToPlay }
}
