import { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '../socket'
import { useSounds } from '../audio/useSounds'
import type { TileState, PlayerInfo, RoundEndData, MatchEndData, Screen, LobbyRoom } from '../types'

export interface OpponentAttempt {
  result: TileState[]
}

export interface GameState {
  screen: Screen
  roomCode: string
  myName: string
  isHost: boolean
  isPublic: boolean
  roomName: string
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
  timeLeft: number      // seconds; -1 = no active timer
  roundDuration: number // minutes, for adaptive tick thresholds
  lobbyRooms: LobbyRoom[]
}

const EMPTY_LETTERS = ['', '', '', '', '']

const INITIAL: GameState = {
  screen: 'home',
  roomCode: '',
  myName: '',
  isHost: false,
  isPublic: false,
  roomName: '',
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
  roundDuration: 3,
  lobbyRooms: [],
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
  const ALL_THRESHOLDS = [60, 30, 10, 5, 4, 3, 2, 1]
  useEffect(() => {
    if (state.screen !== 'game') return
    const roundSecs = state.roundDuration * 60
    const activeThresholds = ALL_THRESHOLDS.filter(t => t < roundSecs)
    const interval = setInterval(() => {
      const t = Math.max(0, Math.round((roundEndTimeRef.current - Date.now()) / 1000))
      setState(s => s.screen === 'game' ? { ...s, timeLeft: t } : s)
      for (const threshold of activeThresholds) {
        if (t <= threshold && !timerSoundedRef.current.has(threshold)) {
          timerSoundedRef.current.add(threshold)
          soundsRef.current.onTick(threshold)
          break
        }
      }
    }, 500)
    return () => clearInterval(interval)
  }, [state.screen, state.currentRound, state.roundDuration, sounds])

  useEffect(() => {
    const socket = getSocket()

    socket.on('connect', () => {
      if (hasConnectedRef.current) {
        setState(s => s.screen !== 'home' ? { ...INITIAL, toast: 'Conexão perdida. Tente novamente.' } : s)
        setTimeout(() => setState(s => ({ ...s, toast: null })), 3000)
      }
      hasConnectedRef.current = true
    })

    socket.on('room_created', ({ code, maxPlayers, roundDuration, isPublic, roomName, isHost }: {
      code: string; maxPlayers: number; roundDuration: number; isPublic: boolean; roomName: string; isHost: boolean
    }) => {
      setState(s => ({
        ...s,
        screen: 'waiting',
        roomCode: code,
        maxPlayers,
        roundDuration,
        isPublic,
        roomName,
        isHost,
        waitingPlayers: [{ name: s.myName, score: 0 }],
      }))
    })

    socket.on('room_joined', ({ code, maxPlayers, roundDuration, isPublic, roomName, isHost, players }: {
      code: string; maxPlayers: number; roundDuration: number; isPublic: boolean; roomName: string; isHost: boolean; players: PlayerInfo[]
    }) => {
      setState(s => ({
        ...s,
        screen: 'waiting',
        roomCode: code,
        maxPlayers,
        roundDuration,
        isPublic,
        roomName,
        isHost,
        waitingPlayers: players,
      }))
    })

    socket.on('player_joined', ({ players, maxPlayers }: { players: PlayerInfo[]; maxPlayers: number }) => {
      setState(s => ({ ...s, waitingPlayers: players, maxPlayers }))
    })

    socket.on('host_changed', ({ hostName }: { hostName: string }) => {
      setState(s => ({ ...s, isHost: s.myName === hostName }))
    })

    socket.on('lobby_update', (rooms: LobbyRoom[]) => {
      setState(s => ({ ...s, lobbyRooms: rooms }))
    })

    socket.on('room_deleted', () => {
      getSocket().disconnect()
      setState({ ...INITIAL, toast: 'Sala excluída pelo host.' })
      setTimeout(() => setState(s => ({ ...s, toast: null })), 3000)
    })

    socket.on('game_start', ({ players }: { players: PlayerInfo[] }) => {
      setState(s => ({ ...s, screen: 'game', players }))
    })

    socket.on('round_start', ({ round, totalRounds, roundEndTime, roundDuration }: { round: number; totalRounds: number; roundEndTime: number; roundDuration: number }) => {
      roundEndTimeRef.current = roundEndTime
      timerSoundedRef.current = new Set()
      setState(s => ({
        ...s,
        screen: 'game',
        currentRound: round,
        totalRounds,
        roundDuration,
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

    socket.on('error', ({ message }: { message: string }) => {
      setState(s => ({ ...s, toast: message }))
      setTimeout(() => setState(s => ({ ...s, toast: null })), 2000)
    })

    return () => {
      socket.off('connect')
      socket.off('room_created')
      socket.off('room_joined')
      socket.off('player_joined')
      socket.off('host_changed')
      socket.off('lobby_update')
      socket.off('room_deleted')
      socket.off('game_start')
      socket.off('round_start')
      socket.off('guess_result')
      socket.off('opponent_progress')
      socket.off('round_end')
      socket.off('match_end')
      socket.off('player_left')
      socket.off('error')
    }
  }, [])

  const createRoom = useCallback((playerName: string, maxPlayers: number, roundDuration: number, isPublic: boolean, roomName: string) => {
    setState(s => ({ ...s, myName: playerName }))
    getSocket().connect()
    getSocket().emit('create_room', { playerName, maxPlayers, roundDuration, isPublic, roomName })
  }, [])

  const joinRoom = useCallback((code: string, playerName: string) => {
    setState(s => ({ ...s, myName: playerName }))
    getSocket().connect()
    getSocket().emit('join_room', { code, playerName })
    history.replaceState(null, '', location.pathname)
  }, [])

  const openLobby = useCallback((playerName: string) => {
    setState(s => ({ ...s, myName: playerName, screen: 'lobby', lobbyRooms: [] }))
    getSocket().connect()
    getSocket().emit('browse_lobby')
  }, [])

  const leaveLobby = useCallback(() => {
    getSocket().emit('leave_lobby')
    setState(s => ({ ...s, screen: 'home' }))
  }, [])

  const deleteRoom = useCallback(() => {
    getSocket().emit('delete_room')
  }, [])

  const goToCreateRoom = useCallback((playerName: string) => {
    setState(s => ({ ...s, myName: playerName, screen: 'create_room' }))
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
    getSocket().disconnect()
    setState(INITIAL)
  }, [])

  const goToHowToPlay = useCallback((show: boolean) => {
    setState(s => ({ ...s, screen: show ? 'how_to_play' : 'home' }))
  }, [])

  return {
    state,
    createRoom,
    joinRoom,
    openLobby,
    leaveLobby,
    deleteRoom,
    goToCreateRoom,
    onKeyPress,
    playAgain,
    muted,
    toggleMute,
    goToHowToPlay,
  }
}
