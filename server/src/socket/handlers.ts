import { Server, Socket } from 'socket.io'
import { Redis } from 'ioredis'
import { evaluateGuess, normalize, bestAttemptScore } from '../game/logic'
import { isValidGuess, getDisplayWord } from '../game/words'
import {
  createRoom, joinRoom, getRoom, saveRoom,
  getRoomBySocketId, setSocketRoom, removeSocketRoom,
  getPlayerIndex, advanceRound,
  deleteRoom, removeFromLobby, getLobbyRooms, transferHost,
} from '../game/room'
import { Room } from '../types'

const MAX_ATTEMPTS = 6
const DEFAULT_ROUND_DURATION = 3  // minutes
const NEXT_ROUND_DELAY_MS = 4000

// In-memory timers keyed by room code
const roomTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearRoomTimer(code: string) {
  const t = roomTimers.get(code)
  if (t) { clearTimeout(t); roomTimers.delete(code) }
}

function emitRoundStart(io: Server, room: Room) {
  const roundDurationMs = room.roundDuration * 60 * 1000
  const roundEndTime = Date.now() + roundDurationMs
  io.to(room.code).emit('round_start', {
    round: room.currentRound,
    totalRounds: room.totalRounds,
    roundEndTime,
    roundDuration: room.roundDuration,
  })
  return roundEndTime
}

function scheduleRoundTimeout(io: Server, redis: Redis, room: Room, roundEndTime: number) {
  clearRoomTimer(room.code)
  const delay = roundEndTime - Date.now()
  const t = setTimeout(async () => {
    try {
      const fresh = await getRoom(redis, room.code)
      if (!fresh || fresh.status !== 'playing' || fresh.currentRound !== room.currentRound) return
      for (const rs of fresh.roundStates) {
        if (!rs.done) { rs.done = true; rs.solved = false }
      }
      await saveRoom(redis, fresh)
      await resolveRound(io, redis, fresh, true)
    } catch (err) {
      console.error('round timeout error:', err)
    }
  }, delay)
  roomTimers.set(room.code, t)
}

async function broadcastLobbyUpdate(io: Server, redis: Redis) {
  const rooms = await getLobbyRooms(redis)
  io.to('lobby').emit('lobby_update', rooms)
}

export function registerHandlers(io: Server, socket: Socket, redis: Redis) {

  socket.on('create_room', async (data: {
    playerName: string
    maxPlayers?: number
    roundDuration?: number
    isPublic?: boolean
    roomName?: string
  }) => {
    try {
      const playerName = (data?.playerName ?? '').trim().slice(0, 20)
      if (!playerName) { socket.emit('error', { message: 'Nome inválido.' }); return }

      const maxPlayers = Math.min(4, Math.max(2, Math.floor(data?.maxPlayers ?? 2)))
      const roundDuration = Math.min(10, Math.max(1, Math.round(data?.roundDuration ?? DEFAULT_ROUND_DURATION)))
      const isPublic = data?.isPublic === true
      const roomName = (data?.roomName ?? '').trim().slice(0, 30)

      if (isPublic && !roomName) { socket.emit('error', { message: 'Nome da sala obrigatório.' }); return }

      // Leave any previous room so stale socket.io room membership doesn't linger
      const prevCode = await redis.get(`socket:${socket.id}`)
      if (prevCode) socket.leave(prevCode)

      socket.leave('lobby')

      const room = await createRoom(redis, socket.id, playerName, maxPlayers, roundDuration, isPublic, roomName)
      await setSocketRoom(redis, socket.id, room.code)
      socket.join(room.code)

      socket.emit('room_created', {
        code: room.code,
        maxPlayers: room.maxPlayers,
        roundDuration: room.roundDuration,
        isPublic: room.isPublic,
        roomName: room.roomName,
        isHost: true,
      })

      if (isPublic) await broadcastLobbyUpdate(io, redis)
    } catch (err) {
      console.error('create_room error:', err)
      socket.emit('error', { message: 'Erro ao criar sala.' })
    }
  })

  socket.on('join_room', async (data: { code: string; playerName: string }) => {
    try {
      const playerName = (data?.playerName ?? '').trim().slice(0, 20)
      const code = (data?.code ?? '').toUpperCase().trim()
      if (!playerName) { socket.emit('error', { message: 'Nome inválido.' }); return }
      if (!code) { socket.emit('error', { message: 'Código inválido.' }); return }

      // Prevent duplicate names in the same room
      const existing = await getRoom(redis, code.toUpperCase())
      if (existing && existing.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
        socket.emit('error', { message: 'Já existe um jogador com esse nome nesta sala.' })
        return
      }

      const room = await joinRoom(redis, code, socket.id, playerName)
      if (!room) {
        socket.emit('error', { message: 'Sala não encontrada ou já está cheia.' })
        return
      }

      // Leave lobby channel and any previous room
      socket.leave('lobby')
      const prevCode = await redis.get(`socket:${socket.id}`)
      if (prevCode && prevCode !== room.code) socket.leave(prevCode)

      await setSocketRoom(redis, socket.id, room.code)
      socket.join(room.code)

      const playerList = room.players.map(p => ({ name: p.name, score: p.score }))

      if (room.status === 'playing') {
        // Room is now full — remove from lobby and start game
        if (room.isPublic) await removeFromLobby(redis, room.code)
        if (room.isPublic) await broadcastLobbyUpdate(io, redis)

        io.to(room.code).emit('game_start', { players: playerList })

        setTimeout(() => {
          const roundEndTime = emitRoundStart(io, room)
          scheduleRoundTimeout(io, redis, room, roundEndTime)
        }, 1000)
      } else {
        // Room still waiting for more players — update lobby count
        if (room.isPublic) await broadcastLobbyUpdate(io, redis)

        socket.emit('room_joined', {
          code: room.code,
          maxPlayers: room.maxPlayers,
          roundDuration: room.roundDuration,
          isPublic: room.isPublic,
          roomName: room.roomName,
          isHost: false,
          players: playerList,
        })
        socket.to(room.code).emit('player_joined', {
          players: playerList,
          maxPlayers: room.maxPlayers,
        })
      }
    } catch (err) {
      console.error('join_room error:', err)
      socket.emit('error', { message: 'Erro ao entrar na sala.' })
    }
  })

  socket.on('browse_lobby', async () => {
    try {
      socket.join('lobby')
      const rooms = await getLobbyRooms(redis)
      socket.emit('lobby_update', rooms)
    } catch (err) {
      console.error('browse_lobby error:', err)
    }
  })

  socket.on('leave_lobby', () => {
    socket.leave('lobby')
  })

  socket.on('delete_room', async () => {
    try {
      const room = await getRoomBySocketId(redis, socket.id)
      if (!room) return
      if (room.hostSocketId !== socket.id) return
      if (room.status !== 'waiting') return

      await deleteRoom(redis, room.code)
      await removeSocketRoom(redis, socket.id)

      // Notify all players in the room (besides host)
      socket.to(room.code).emit('room_deleted')
      socket.leave(room.code)

      if (room.isPublic) await broadcastLobbyUpdate(io, redis)
    } catch (err) {
      console.error('delete_room error:', err)
    }
  })

  socket.on('submit_guess', async (data: { guess: string }) => {
    try {
      const room = await getRoomBySocketId(redis, socket.id)
      if (!room || room.status !== 'playing') {
        socket.emit('error', { message: 'Nenhuma partida em andamento.' })
        return
      }

      const playerIdx = getPlayerIndex(room, socket.id)
      if (playerIdx === -1) { socket.emit('error', { message: 'Jogador não encontrado.' }); return }

      const roundState = room.roundStates[playerIdx]
      if (roundState.done) { socket.emit('error', { message: 'Você já terminou esta rodada.' }); return }

      const guess = normalize(data?.guess ?? '')
      if (guess.length !== 5) {
        socket.emit('guess_result', { valid: false, message: 'Palavra deve ter 5 letras.' })
        return
      }
      if (!isValidGuess(guess)) {
        socket.emit('guess_result', { valid: false, message: 'Palavra não encontrada.' })
        return
      }

      const result = evaluateGuess(guess, room.currentWord)
      const solved = result.every(r => r === 'correct')
      const attempt = roundState.guesses.length + 1

      roundState.guesses.push(guess)
      roundState.results.push(result)

      if (solved || attempt >= MAX_ATTEMPTS) {
        roundState.done = true
        roundState.solved = solved
      }

      await saveRoom(redis, room)

      socket.emit('guess_result', { valid: true, guess: getDisplayWord(guess), result, attempt, solved, done: roundState.done })

      // Notify all other players of this player's progress
      const senderName = room.players[playerIdx].name
      for (let i = 0; i < room.players.length; i++) {
        if (i !== playerIdx) {
          io.to(room.players[i].socketId).emit('opponent_progress', {
            playerName: senderName,
            attempt,
            result,
            done: roundState.done,
            solved: roundState.solved,
          })
        }
      }

      if (solved || room.roundStates.every(rs => rs.done)) {
        await resolveRound(io, redis, room, false)
      }
    } catch (err) {
      console.error('submit_guess error:', err)
      socket.emit('error', { message: 'Erro ao processar tentativa.' })
    }
  })

  socket.on('disconnect', async () => {
    try {
      const room = await getRoomBySocketId(redis, socket.id)
      await removeSocketRoom(redis, socket.id)

      if (!room || room.status === 'finished') return

      clearRoomTimer(room.code)

      const playerIdx = getPlayerIndex(room, socket.id)
      if (playerIdx === -1) return

      const disconnectedName = room.players[playerIdx].name
      const wasHost = room.hostSocketId === socket.id
      const wasPlaying = room.status === 'playing'

      room.players.splice(playerIdx, 1)
      room.roundStates.splice(playerIdx, 1)

      if (room.players.length === 0) {
        await deleteRoom(redis, room.code)
        if (room.isPublic) await broadcastLobbyUpdate(io, redis)
        return
      }

      // Transfer host if the disconnected player was host
      if (wasHost && !wasPlaying) {
        transferHost(room)
        io.to(room.code).emit('host_changed', {
          hostName: room.players.find(p => p.socketId === room.hostSocketId)?.name ?? '',
        })
      }

      const remainingPlayers = room.players.map(p => ({ name: p.name, score: p.score }))

      if (room.players.length === 1) {
        room.status = 'finished'
        await saveRoom(redis, room)
        if (room.isPublic) {
          await removeFromLobby(redis, room.code)
          await broadcastLobbyUpdate(io, redis)
        }

        const winner = room.players[0]
        io.to(winner.socketId).emit('player_left', {
          playerName: disconnectedName,
          players: remainingPlayers,
        })
        if (wasPlaying) {
          setTimeout(() => {
            io.to(winner.socketId).emit('match_end', {
              winnerName: winner.name,
              scores: { [winner.name]: winner.score },
            })
          }, 2000)
        }
        return
      }

      // 2+ players remain — continue
      if (room.isPublic && !wasPlaying) await broadcastLobbyUpdate(io, redis)

      for (const p of room.players) {
        io.to(p.socketId).emit('player_left', {
          playerName: disconnectedName,
          players: remainingPlayers,
        })
      }

      if (wasPlaying && room.roundStates.every(rs => rs.done)) {
        await resolveRound(io, redis, room, false)
      } else {
        await saveRoom(redis, room)
      }
    } catch (err) {
      console.error('disconnect error:', err)
    }
  })
}

async function resolveRound(io: Server, redis: Redis, room: Room, timedOut: boolean): Promise<void> {
  const lockKey = `lock:${room.code}:${room.currentRound}`
  const acquired = await redis.set(lockKey, '1', 'EX', 30, 'NX')
  if (!acquired) return

  clearRoomTimer(room.code)

  // Determine round winner for N players
  const entries = room.players.map((p, i) => ({
    player: p,
    state: room.roundStates[i],
    idx: i,
  }))

  const solvers = entries
    .filter(e => e.state.solved)
    .sort((a, b) => a.state.guesses.length - b.state.guesses.length)

  let winnerIdx: number | null = null

  if (solvers.length === 1) {
    winnerIdx = solvers[0].idx
  } else if (solvers.length > 1 && solvers[0].state.guesses.length < solvers[1].state.guesses.length) {
    winnerIdx = solvers[0].idx
  } else if (solvers.length === 0) {
    const nonEmpty = entries.filter(e => e.state.results.length > 0)
    if (nonEmpty.length > 0) {
      const scored = nonEmpty
        .map(e => ({ idx: e.idx, score: bestAttemptScore(e.state.results) }))
        .sort((a, b) => b.score[0] - a.score[0] || b.score[1] - a.score[1])
      if (scored.length === 1 || scored[0].score[0] !== scored[1].score[0] || scored[0].score[1] !== scored[1].score[1]) {
        winnerIdx = scored[0].idx
      }
    }
  }

  if (winnerIdx !== null) room.players[winnerIdx].score++

  const scores = Object.fromEntries(room.players.map(p => [p.name, p.score]))
  const playerResults = Object.fromEntries(
    room.players.map((p, i) => [p.name, {
      guesses: room.roundStates[i].guesses.map(getDisplayWord),
      results: room.roundStates[i].results,
      solved: room.roundStates[i].solved,
    }])
  )

  io.to(room.code).emit('round_end', {
    round: room.currentRound,
    word: room.currentWordDisplay || room.currentWord,
    winnerName: winnerIdx !== null ? room.players[winnerIdx].name : null,
    scores,
    playerResults,
    timedOut,
  })

  if (room.currentRound >= room.totalRounds) {
    room.status = 'finished'
    await saveRoom(redis, room)

    const maxScore = Math.max(...room.players.map(p => p.score))
    const topPlayers = room.players.filter(p => p.score === maxScore)
    const matchWinner = topPlayers.length === 1 ? topPlayers[0] : null

    setTimeout(() => {
      io.to(room.code).emit('match_end', {
        winnerName: matchWinner?.name ?? null,
        scores,
      })
    }, NEXT_ROUND_DELAY_MS)
  } else {
    advanceRound(room)
    await saveRoom(redis, room)

    setTimeout(() => {
      const roundEndTime = emitRoundStart(io, room)
      scheduleRoundTimeout(io, redis, room, roundEndTime)
    }, NEXT_ROUND_DELAY_MS)
  }
}
