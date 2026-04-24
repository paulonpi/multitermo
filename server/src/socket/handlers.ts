import { Server, Socket } from 'socket.io'
import { Redis } from 'ioredis'
import { evaluateGuess, normalize } from '../game/logic'
import { isValidGuess } from '../game/words'
import {
  createRoom, joinRoom, getRoom, saveRoom,
  getRoomBySocketId, setSocketRoom, removeSocketRoom,
  getPlayerIndex, advanceRound,
} from '../game/room'
import { Room } from '../types'

const MAX_ATTEMPTS = 6
const NEXT_ROUND_DELAY_MS = 4000

export function registerHandlers(io: Server, socket: Socket, redis: Redis) {
  socket.on('create_room', async (data: { playerName: string }) => {
    try {
      const playerName = (data?.playerName ?? '').trim().slice(0, 20)
      if (!playerName) { socket.emit('error', { message: 'Nome inválido.' }); return }

      const room = await createRoom(redis, socket.id, playerName)
      await setSocketRoom(redis, socket.id, room.code)
      socket.join(room.code)

      socket.emit('room_created', { code: room.code })
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

      const room = await joinRoom(redis, code, socket.id, playerName)
      if (!room) {
        socket.emit('error', { message: 'Sala não encontrada ou já está cheia.' })
        return
      }

      await setSocketRoom(redis, socket.id, room.code)
      socket.join(room.code)

      // Inform both players the match is starting
      io.to(room.code).emit('game_start', {
        players: room.players.map(p => ({ name: p.name, score: p.score })),
      })

      setTimeout(() => {
        io.to(room.code).emit('round_start', {
          round: room.currentRound,
          totalRounds: room.totalRounds,
        })
      }, 1000)
    } catch (err) {
      console.error('join_room error:', err)
      socket.emit('error', { message: 'Erro ao entrar na sala.' })
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

      socket.emit('guess_result', { valid: true, guess, result, attempt, solved, done: roundState.done })

      // Notify opponent of progress (tile colors only, no letters)
      const opponentIdx = 1 - playerIdx
      if (room.players[opponentIdx]) {
        io.to(room.players[opponentIdx].socketId).emit('opponent_progress', {
          attempt,
          result,
          done: roundState.done,
          solved: roundState.solved,
        })
      }

      const allDone = room.roundStates.every(rs => rs.done)
      if (allDone) {
        await resolveRound(io, redis, room)
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

      const opponentIdx = 1 - getPlayerIndex(room, socket.id)
      if (room.players[opponentIdx]) {
        io.to(room.players[opponentIdx].socketId).emit('opponent_disconnected')
      }
      room.status = 'finished'
      await saveRoom(redis, room)
    } catch (err) {
      console.error('disconnect error:', err)
    }
  })
}

async function resolveRound(io: Server, redis: Redis, room: Room): Promise<void> {
  // Atomic guard: only one resolveRound runs per round
  const lockKey = `lock:${room.code}:${room.currentRound}`
  const acquired = await redis.set(lockKey, '1', 'EX', 30, 'NX')
  if (!acquired) return

  const [s0, s1] = room.roundStates
  const [p0, p1] = room.players

  let winnerIdx: number | null = null
  if (s0.solved && !s1.solved) winnerIdx = 0
  else if (!s0.solved && s1.solved) winnerIdx = 1
  else if (s0.solved && s1.solved) {
    if (s0.guesses.length < s1.guesses.length) winnerIdx = 0
    else if (s1.guesses.length < s0.guesses.length) winnerIdx = 1
    // else draw: no point
  }

  if (winnerIdx !== null) room.players[winnerIdx].score++

  io.to(room.code).emit('round_end', {
    round: room.currentRound,
    word: room.currentWord,
    winnerName: winnerIdx !== null ? room.players[winnerIdx].name : null,
    scores: { [p0.name]: room.players[0].score, [p1.name]: room.players[1].score },
    playerResults: {
      [p0.name]: { guesses: s0.guesses, results: s0.results, solved: s0.solved },
      [p1.name]: { guesses: s1.guesses, results: s1.results, solved: s1.solved },
    },
  })

  if (room.currentRound >= room.totalRounds) {
    room.status = 'finished'
    await saveRoom(redis, room)

    const matchWinner =
      room.players[0].score > room.players[1].score ? room.players[0] :
      room.players[1].score > room.players[0].score ? room.players[1] : null

    setTimeout(() => {
      io.to(room.code).emit('match_end', {
        winnerName: matchWinner?.name ?? null,
        scores: { [p0.name]: room.players[0].score, [p1.name]: room.players[1].score },
      })
    }, NEXT_ROUND_DELAY_MS)
  } else {
    advanceRound(room)
    await saveRoom(redis, room)

    setTimeout(() => {
      io.to(room.code).emit('round_start', {
        round: room.currentRound,
        totalRounds: room.totalRounds,
      })
    }, NEXT_ROUND_DELAY_MS)
  }
}
