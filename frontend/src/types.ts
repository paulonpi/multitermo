export type TileState = 'correct' | 'present' | 'absent'
export type TileStatus = 'empty' | 'input' | TileState

export interface PlayerInfo {
  name: string
  score: number
}

export interface RoundResult {
  guesses: string[]
  results: TileState[][]
  solved: boolean
}

export interface RoundEndData {
  round: number
  word: string
  winnerName: string | null
  scores: Record<string, number>
  playerResults: Record<string, RoundResult>
  timedOut?: boolean
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

export interface MatchEndData {
  winnerName: string | null
  scores: Record<string, number>
  rounds: RoundHistoryEntry[]
}

export type Screen = 'home' | 'lobby' | 'create_room' | 'waiting' | 'game' | 'round_end' | 'match_end' | 'how_to_play'

export interface LobbyRoom {
  code: string
  name: string
  hostName: string
  players: number
  maxPlayers: number
  roundDuration: number
}
