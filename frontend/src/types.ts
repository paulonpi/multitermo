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

export interface MatchEndData {
  winnerName: string | null
  scores: Record<string, number>
}

export type Screen = 'home' | 'waiting' | 'game' | 'round_end' | 'match_end'
