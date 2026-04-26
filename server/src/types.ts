export type TileState = 'correct' | 'present' | 'absent'

export interface Player {
  socketId: string
  name: string
  score: number
}

export interface PlayerRoundState {
  guesses: string[]
  results: TileState[][]
  done: boolean
  solved: boolean
}

export type RoomStatus = 'waiting' | 'playing' | 'finished'

export interface Room {
  code: string
  status: RoomStatus
  maxPlayers: number
  roundDuration: number  // minutes, 1–10
  isPublic: boolean
  roomName: string
  hostSocketId: string
  players: Player[]
  currentRound: number
  totalRounds: number
  currentWord: string
  currentWordDisplay: string
  roundStates: PlayerRoundState[]
  history: RoundHistoryEntry[]
}

export interface RoundHistoryEntry {
  round: number
  word: string
  winnerName: string | null
  playerResults: Record<string, {
    guesses: string[]
    results: TileState[][]
    solved: boolean
  }>
}

export interface LobbyRoom {
  code: string
  name: string
  hostName: string
  players: number
  maxPlayers: number
  roundDuration: number
}
