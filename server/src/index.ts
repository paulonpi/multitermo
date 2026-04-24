import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import Redis from 'ioredis'
import { registerHandlers } from './socket/handlers'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.get('/health', (_, res) => res.json({ status: 'ok' }))

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
})

const redis = new Redis(REDIS_URL)
redis.on('connect', () => console.log('Redis connected'))
redis.on('error', err => console.error('Redis error:', err))

io.on('connection', socket => {
  console.log(`+ ${socket.id}`)
  registerHandlers(io, socket, redis)
  socket.on('disconnect', () => console.log(`- ${socket.id}`))
})

httpServer.listen(PORT, () => console.log(`Server on :${PORT}`))
