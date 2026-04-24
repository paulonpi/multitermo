import { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '../socket'
import type { TileState, PlayerInfo, RoundEndData, MatchEndData, Screen } from '../types'

export interface OpponentAttempt {
  result: TileState[]
}

export interface GameState {
  screen: Screen
  roomCode: string
  myName: string
  players: PlayerInfo[]
  currentRound: number
  totalRounds: number
  guesses: string[]
  results: TileState[][]
  currentLetters: string[]
  cursorPos: number
  opponentAttempts: OpponentAttempt[]
  opponentDone: boolean
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
  currentRound: 1,
  totalRounds: 5,
  guesses: [],
  results: [],
  currentLetters: EMPTY_LETTERS,
  cursorPos: 0,
  opponentAttempts: [],
  opponentDone: false,
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

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Countdown ticker — runs while on game screen
  useEffect(() => {
    if (state.screen !== 'game') return
    const interval = setInterval(() => {
      const t = Math.max(0, Math.round((roundEndTimeRef.current - Date.now()) / 1000))
      setState(s => s.screen === 'game' ? { ...s, timeLeft: t } : s)
    }, 500)
    return () => clearInterval(interval)
  }, [state.screen, state.currentRound])

  useEffect(() => {
    const socket = getSocket()

    socket.on('room_created', ({ code }: { code: string }) => {
      setState(s => ({ ...s, screen: 'waiting', roomCode: code }))
    })

    socket.on('game_start', ({ players }: { players: PlayerInfo[] }) => {
      setState(s => ({ ...s, screen: 'game', players }))
    })

    socket.on('round_start', ({ round, totalRounds, roundEndTime }: { round: number; totalRounds: number; roundEndTime: number }) => {
      roundEndTimeRef.current = roundEndTime
      setState(s => ({
        ...s,
        screen: 'game',
        currentRound: round,
        totalRounds,
        guesses: [],
        results: [],
        ...resetInput(),
        opponentAttempts: [],
        opponentDone: false,
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
        setState(s => ({ ...s, shakeRow: true, toast: data.message ?? 'Palavra inválida.' }))
        setTimeout(() => setState(s => ({ ...s, shakeRow: false, toast: null })), 1500)
        return
      }
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

    socket.on('opponent_progress', (data: { result: TileState[]; done: boolean }) => {
      setState(s => ({
        ...s,
        opponentAttempts: [...s.opponentAttempts, { result: data.result }],
        opponentDone: data.done,
      }))
    })

    socket.on('round_end', (data: RoundEndData) => {
      setState(s => ({
        ...s,
        screen: 'round_end',
        roundEndData: data,
        players: s.players.map(p => ({ ...p, score: data.scores[p.name] ?? p.score })),
      }))
    })

    socket.on('match_end', (data: MatchEndData) => {
      setState(s => ({ ...s, screen: 'match_end', matchEndData: data }))
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
      socket.off('room_created')
      socket.off('game_start')
      socket.off('round_start')
      socket.off('guess_result')
      socket.off('opponent_progress')
      socket.off('round_end')
      socket.off('match_end')
      socket.off('opponent_disconnected')
      socket.off('error')
    }
  }, [])

  const createRoom = useCallback((playerName: string) => {
    setState(s => ({ ...s, myName: playerName }))
    getSocket().connect()
    getSocket().emit('create_room', { playerName })
  }, [])

  const joinRoom = useCallback((code: string, playerName: string) => {
    setState(s => ({ ...s, myName: playerName }))
    getSocket().connect()
    getSocket().emit('join_room', { code, playerName })
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

    if (key === 'BACKSPACE') {
      setState(prev => {
        const letters = [...prev.currentLetters]
        if (letters[prev.cursorPos] !== '') {
          // Clear current cell, cursor stays
          letters[prev.cursorPos] = ''
          return { ...prev, currentLetters: letters }
        } else if (prev.cursorPos > 0) {
          // Move left and clear that cell
          letters[prev.cursorPos - 1] = ''
          return { ...prev, currentLetters: letters, cursorPos: prev.cursorPos - 1 }
        }
        return prev
      })
      return
    }

    if (key === 'ENTER') {
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
    getSocket().disconnect()
    setState(INITIAL)
  }, [])

  return { state, createRoom, joinRoom, onKeyPress, playAgain }
}
