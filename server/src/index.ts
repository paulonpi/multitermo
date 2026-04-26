import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import Redis from 'ioredis'
import { registerHandlers } from './socket/handlers'
import { shareHandler } from './routes/share'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const redis = new Redis(REDIS_URL)
redis.on('connect', () => console.log('Redis connected'))
redis.on('error', err => console.error('Redis error:', err))

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))

app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.get('/share', shareHandler)

app.get('/room/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim()
    const data = await redis.get(`room:${code}`)
    if (!data) { res.json({ exists: false }); return }
    const room = JSON.parse(data) as { status: string; players: unknown[]; maxPlayers: number }
    const joinable = room.status === 'waiting' && room.players.length < room.maxPlayers
    res.json({
      exists: true,
      joinable,
      status: room.status,
      currentPlayers: room.players.length,
      maxPlayers: room.maxPlayers,
    })
  } catch {
    res.status(500).json({ exists: false })
  }
})

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
})

io.on('connection', socket => {
  console.log(`+ ${socket.id}`)
  registerHandlers(io, socket, redis)
  socket.on('disconnect', () => console.log(`- ${socket.id}`))
})

httpServer.listen(PORT, () => console.log(`Server on :${PORT}`))
