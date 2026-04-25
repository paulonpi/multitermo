import { Redis } from 'ioredis'
import { Room, Player, PlayerRoundState } from '../types'
import { pickRandomWord, getDisplayWord } from './words'

const ROOM_TTL = 3600
const TOTAL_ROUNDS = 5
const CONSONANTS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

function roomKey(code: string) { return `room:${code}` }
function socketKey(socketId: string) { return `socket:${socketId}` }

function emptyRoundState(): PlayerRoundState {
  return { guesses: [], results: [], done: false, solved: false }
}

function generateCode(): string {
  return Array.from(
    { length: 4 },
    () => CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)]
  ).join('')
}

export async function createRoom(redis: Redis, socketId: string, playerName: string, maxPlayers: number): Promise<Room> {
  const code = generateCode()
  const player: Player = { socketId, name: playerName, score: 0 }
  const room: Room = {
    code,
    status: 'waiting',
    maxPlayers,
    players: [player],
    currentRound: 1,
    totalRounds: TOTAL_ROUNDS,
    currentWord: '',
    currentWordDisplay: '',
    roundStates: [emptyRoundState()],
  }
  await saveRoom(redis, room)
  return room
}

export async function joinRoom(
  redis: Redis,
  code: string,
  socketId: string,
  playerName: string,
): Promise<Room | null> {
  const room = await getRoom(redis, code)
  if (!room || room.status !== 'waiting' || room.players.length >= room.maxPlayers) return null

  room.players.push({ socketId, name: playerName, score: 0 })
  room.roundStates.push(emptyRoundState())

  if (room.players.length === room.maxPlayers) {
    room.status = 'playing'
    room.currentWord = pickRandomWord()
    room.currentWordDisplay = getDisplayWord(room.currentWord)
  }

  await saveRoom(redis, room)
  return room
}

export async function getRoom(redis: Redis, code: string): Promise<Room | null> {
  const data = await redis.get(roomKey(code))
  return data ? (JSON.parse(data) as Room) : null
}

export async function saveRoom(redis: Redis, room: Room): Promise<void> {
  await redis.setex(roomKey(room.code), ROOM_TTL, JSON.stringify(room))
}

export async function getRoomBySocketId(redis: Redis, socketId: string): Promise<Room | null> {
  const code = await redis.get(socketKey(socketId))
  return code ? getRoom(redis, code) : null
}

export async function setSocketRoom(redis: Redis, socketId: string, code: string): Promise<void> {
  await redis.setex(socketKey(socketId), ROOM_TTL, code)
}

export async function removeSocketRoom(redis: Redis, socketId: string): Promise<void> {
  await redis.del(socketKey(socketId))
}

export function getPlayerIndex(room: Room, socketId: string): number {
  return room.players.findIndex(p => p.socketId === socketId)
}

export function advanceRound(room: Room): void {
  room.currentRound++
  room.currentWord = pickRandomWord()
  room.currentWordDisplay = getDisplayWord(room.currentWord)
  room.roundStates = room.players.map(() => emptyRoundState())
}
