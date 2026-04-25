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
  players: Player[]
  currentRound: number
  totalRounds: number
  currentWord: string
  currentWordDisplay: string
  roundStates: PlayerRoundState[]
}
