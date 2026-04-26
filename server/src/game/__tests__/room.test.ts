import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Redis } from 'ioredis'
import { createRoom, joinRoom, getRoom, advanceRound, getPlayerIndex, getLobbyRooms, transferHost, buildRoundHistory } from '../room'

// Mock the words module so tests don't need the word-list files on disk
vi.mock('../words', () => ({
  pickRandomWord: vi.fn(() => 'arroz'),
  getDisplayWord: vi.fn((w: string) => w),
}))

// ─── Minimal Redis mock (in-memory key-value store) ───────────────────────────

function makeRedisMock() {
  const store = new Map<string, string>()
  const sets = new Map<string, Set<string>>()
  return {
    get:      vi.fn((key: string)                          => Promise.resolve(store.get(key) ?? null)),
    set:      vi.fn((key: string, value: string)           => { store.set(key, value); return Promise.resolve('OK' as const) }),
    setex:    vi.fn((key: string, _ttl: number, v: string) => { store.set(key, v);     return Promise.resolve('OK' as const) }),
    del:      vi.fn((key: string)                          => { store.delete(key);     return Promise.resolve(1) }),
    sadd:     vi.fn((key: string, member: string)          => { if (!sets.has(key)) sets.set(key, new Set()); sets.get(key)!.add(member); return Promise.resolve(1) }),
    srem:     vi.fn((key: string, member: string)          => { sets.get(key)?.delete(member); return Promise.resolve(1) }),
    smembers: vi.fn((key: string)                          => Promise.resolve([...(sets.get(key) ?? [])])),
  } as unknown as Redis
}

// ─── createRoom ───────────────────────────────────────────────────────────────

describe('createRoom', () => {
  it('creates a room in waiting status', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 'socket-1', 'Alice', 2, 3)

    expect(room.status).toBe('waiting')
    expect(room.maxPlayers).toBe(2)
    expect(room.players).toHaveLength(1)
    expect(room.players[0]).toMatchObject({ socketId: 'socket-1', name: 'Alice', score: 0 })
    expect(room.currentWord).toBe('')
    expect(room.roundStates).toHaveLength(1)
  })

  it('generates a 4-character uppercase code', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 2, 3)
    expect(room.code).toMatch(/^[A-Z]{4}$/)
  })

  it('sets totalRounds to 5', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 2, 3)
    expect(room.totalRounds).toBe(5)
    expect(room.currentRound).toBe(1)
  })

  it('persists the room to Redis', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 2, 3)
    const fetched = await getRoom(redis, room.code)
    expect(fetched).not.toBeNull()
    expect(fetched!.code).toBe(room.code)
  })

  it('initializes history as empty array', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 2, 3)
    expect(room.history).toEqual([])
  })

  it('sets isPublic false and hostSocketId by default', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 2, 3)
    expect(room.isPublic).toBe(false)
    expect(room.hostSocketId).toBe('s1')
    expect(room.roomName).toBe('')
  })

  it('creates a public room with roomName and adds to lobby:rooms', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 2, 3, true, 'Sala da Alice')
    expect(room.isPublic).toBe(true)
    expect(room.roomName).toBe('Sala da Alice')
    expect(room.hostSocketId).toBe('s1')
    const members = await (redis as any).smembers('lobby:rooms')
    expect(members).toContain(room.code)
  })

  it('does not add private room to lobby:rooms', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 2, 3, false)
    const members = await (redis as any).smembers('lobby:rooms')
    expect(members).not.toContain(room.code)
  })
})

// ─── joinRoom ─────────────────────────────────────────────────────────────────

describe('joinRoom', () => {
  it('adds a second player and keeps status waiting for 3-player room', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 3, 3)
    const updated = await joinRoom(redis, room.code, 's2', 'Bob')

    expect(updated).not.toBeNull()
    expect(updated!.players).toHaveLength(2)
    expect(updated!.status).toBe('waiting')
    expect(updated!.currentWord).toBe('')
  })

  it('starts the game when the last required player joins', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 2, 3)
    const updated = await joinRoom(redis, room.code, 's2', 'Bob')

    expect(updated!.status).toBe('playing')
    expect(updated!.currentWord).toBe('arroz')
    expect(updated!.players).toHaveLength(2)
    expect(updated!.roundStates).toHaveLength(2)
  })

  it('adds a round state entry for each player that joins', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 3, 3)
    await joinRoom(redis, room.code, 's2', 'Bob')
    const final = await joinRoom(redis, room.code, 's3', 'Carol')

    expect(final!.roundStates).toHaveLength(3)
    for (const rs of final!.roundStates) {
      expect(rs).toEqual({ guesses: [], results: [], done: false, solved: false })
    }
  })

  it('returns null for a non-existent room code', async () => {
    const redis = makeRedisMock()
    expect(await joinRoom(redis, 'ZZZZ', 's2', 'Bob')).toBeNull()
  })

  it('returns null when room is already full', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 2, 3)
    await joinRoom(redis, room.code, 's2', 'Bob')            // fills room
    expect(await joinRoom(redis, room.code, 's3', 'Carol')).toBeNull()
  })

  it('returns null when player name is already taken (case-insensitive)', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 3, 3)
    expect(await joinRoom(redis, room.code, 's2', 'alice')).toBeNull()
    expect(await joinRoom(redis, room.code, 's2', 'ALICE')).toBeNull()
    // different name should succeed
    expect(await joinRoom(redis, room.code, 's2', 'Bob')).not.toBeNull()
  })

  it('returns null when room is already playing', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 2, 3)
    await joinRoom(redis, room.code, 's2', 'Bob')            // status → playing
    expect(await joinRoom(redis, room.code, 's3', 'Carol')).toBeNull()
  })
})

// ─── getLobbyRooms ────────────────────────────────────────────────────────────

describe('getLobbyRooms', () => {
  it('returns empty array when no public rooms exist', async () => {
    const redis = makeRedisMock()
    expect(await getLobbyRooms(redis)).toEqual([])
  })

  it('returns public waiting rooms as LobbyRoom list', async () => {
    const redis = makeRedisMock()
    const room = await createRoom(redis, 's1', 'Alice', 3, 5, true, 'Sala top')
    const lobby = await getLobbyRooms(redis)
    expect(lobby).toHaveLength(1)
    expect(lobby[0]).toMatchObject({
      code: room.code,
      name: 'Sala top',
      hostName: 'Alice',
      players: 1,
      maxPlayers: 3,
      roundDuration: 5,
    })
  })

  it('includes multiple public rooms', async () => {
    const redis = makeRedisMock()
    await createRoom(redis, 's1', 'Alice', 2, 3, true, 'Sala A')
    await createRoom(redis, 's2', 'Bob',   2, 5, true, 'Sala B')
    const lobby = await getLobbyRooms(redis)
    expect(lobby).toHaveLength(2)
  })

  it('excludes private rooms', async () => {
    const redis = makeRedisMock()
    await createRoom(redis, 's1', 'Alice', 2, 3, false)
    const lobby = await getLobbyRooms(redis)
    expect(lobby).toHaveLength(0)
  })

  it('skips stale codes whose room no longer exists in Redis', async () => {
    const redis = makeRedisMock()
    // manually add a stale code to the set
    await (redis as any).sadd('lobby:rooms', 'DEAD')
    const lobby = await getLobbyRooms(redis)
    expect(lobby).toHaveLength(0)
  })
})

// ─── transferHost ─────────────────────────────────────────────────────────────

describe('transferHost', () => {
  it('sets hostSocketId to the first remaining player', () => {
    const room = {
      hostSocketId: 's1',
      players: [
        { socketId: 's2', name: 'Bob',   score: 0 },
        { socketId: 's3', name: 'Carol', score: 0 },
      ],
    } as any

    transferHost(room)

    expect(room.hostSocketId).toBe('s2')
  })

  it('does nothing when no players remain', () => {
    const room = { hostSocketId: 's1', players: [] } as any
    transferHost(room)
    expect(room.hostSocketId).toBe('s1')
  })
})

// ─── buildRoundHistory ────────────────────────────────────────────────────────

describe('buildRoundHistory', () => {
  const room = {
    currentRound: 2,
    currentWord: 'gatos',
    currentWordDisplay: 'gatos',
    players: [
      { socketId: 's1', name: 'Alice', score: 1 },
      { socketId: 's2', name: 'Bob',   score: 0 },
    ],
    roundStates: [
      { guesses: ['gatos'], results: [['correct','correct','correct','correct','correct']], done: true, solved: true  },
      { guesses: ['pedra'], results: [['absent', 'absent', 'absent', 'absent', 'absent']], done: true, solved: false },
    ],
  } as any

  it('captures round number and word', () => {
    const entry = buildRoundHistory(room, 'Alice')
    expect(entry.round).toBe(2)
    expect(entry.word).toBe('gatos')
  })

  it('sets winnerName correctly', () => {
    expect(buildRoundHistory(room, 'Alice').winnerName).toBe('Alice')
    expect(buildRoundHistory(room, null).winnerName).toBeNull()
  })

  it('includes guesses and results for each player', () => {
    const entry = buildRoundHistory(room, 'Alice')
    expect(entry.playerResults['Alice'].guesses).toEqual(['gatos'])
    expect(entry.playerResults['Alice'].solved).toBe(true)
    expect(entry.playerResults['Bob'].guesses).toEqual(['pedra'])
    expect(entry.playerResults['Bob'].solved).toBe(false)
  })

  it('falls back to currentWord when currentWordDisplay is empty', () => {
    const r = { ...room, currentWordDisplay: '' }
    const entry = buildRoundHistory(r, null)
    expect(entry.word).toBe('gatos')
  })
})

// ─── advanceRound ─────────────────────────────────────────────────────────────

describe('advanceRound', () => {
  it('increments the round counter', () => {
    const room = {
      currentRound: 1,
      currentWord: 'pedra',
      currentWordDisplay: 'pedra',
      players: [
        { socketId: 's1', name: 'Alice', score: 1 },
        { socketId: 's2', name: 'Bob',   score: 0 },
      ],
      roundStates: [
        { guesses: ['pedra'], results: [['correct','correct','correct','correct','correct']], done: true,  solved: true  },
        { guesses: ['turfa'], results: [['absent', 'absent', 'absent', 'absent', 'absent']], done: true,  solved: false },
      ],
    } as any

    advanceRound(room)

    expect(room.currentRound).toBe(2)
  })

  it('picks a new word', () => {
    const room = {
      currentRound: 2,
      currentWord: 'pedra',
      currentWordDisplay: 'pedra',
      players: [{ socketId: 's1', name: 'Alice', score: 0 }],
      roundStates: [{ guesses: [], results: [], done: true, solved: false }],
    } as any

    advanceRound(room)

    expect(room.currentWord).toBe('arroz')
  })

  it('resets all round states to empty', () => {
    const room = {
      currentRound: 1,
      currentWord: 'pedra',
      currentWordDisplay: 'pedra',
      players: [
        { socketId: 's1', name: 'Alice', score: 0 },
        { socketId: 's2', name: 'Bob',   score: 0 },
      ],
      roundStates: [
        { guesses: ['pedra'], results: [['correct','correct','correct','correct','correct']], done: true, solved: true  },
        { guesses: ['turfa'], results: [['absent', 'absent', 'absent', 'absent', 'absent']], done: true, solved: false },
      ],
    } as any

    advanceRound(room)

    expect(room.roundStates).toHaveLength(2)
    for (const rs of room.roundStates) {
      expect(rs).toEqual({ guesses: [], results: [], done: false, solved: false })
    }
  })

  it('preserves player scores across rounds', () => {
    const room = {
      currentRound: 1,
      currentWord: 'pedra',
      currentWordDisplay: 'pedra',
      players: [
        { socketId: 's1', name: 'Alice', score: 3 },
        { socketId: 's2', name: 'Bob',   score: 1 },
      ],
      roundStates: [
        { guesses: [], results: [], done: true, solved: false },
        { guesses: [], results: [], done: true, solved: false },
      ],
    } as any

    advanceRound(room)

    expect(room.players[0].score).toBe(3)
    expect(room.players[1].score).toBe(1)
  })
})

// ─── getPlayerIndex ───────────────────────────────────────────────────────────

describe('getPlayerIndex', () => {
  const room = {
    players: [
      { socketId: 's1', name: 'Alice', score: 0 },
      { socketId: 's2', name: 'Bob',   score: 0 },
      { socketId: 's3', name: 'Carol', score: 0 },
    ],
  } as any

  it('returns the correct index', () => {
    expect(getPlayerIndex(room, 's1')).toBe(0)
    expect(getPlayerIndex(room, 's2')).toBe(1)
    expect(getPlayerIndex(room, 's3')).toBe(2)
  })

  it('returns -1 for an unknown socket', () => {
    expect(getPlayerIndex(room, 'unknown')).toBe(-1)
  })
})
