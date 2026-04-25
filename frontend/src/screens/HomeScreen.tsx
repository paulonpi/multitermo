import { useState, useEffect, type FormEvent } from 'react'
import { SERVER_URL } from '../socket'

interface RoomStatus {
  exists: boolean
  joinable?: boolean
  status?: string
  currentPlayers?: number
  maxPlayers?: number
}

interface HomeScreenProps {
  onCreateRoom: (name: string, maxPlayers: number, roundDuration: number) => void
  onJoinRoom: (code: string, name: string) => void
  onHowToPlay: () => void
}

export function HomeScreen({ onCreateRoom, onJoinRoom, onHowToPlay }: HomeScreenProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(() => {
    const params = new URLSearchParams(location.search)
    return params.get('room')?.toUpperCase() ?? ''
  })
  const [mode, setMode] = useState<'idle' | 'join'>(() => {
    const params = new URLSearchParams(location.search)
    return params.get('room') ? 'join' : 'idle'
  })
  const [playerCount, setPlayerCount] = useState(2)
  const [roundDuration, setRoundDuration] = useState(3)
  const [roomStatus, setRoomStatus] = useState<RoomStatus | 'loading' | null>(null)

  // Auto-check room status when code is complete
  useEffect(() => {
    if (mode !== 'join' || code.length < 4) {
      setRoomStatus(null)
      return
    }
    setRoomStatus('loading')
    const controller = new AbortController()
    fetch(`${SERVER_URL}/room/${code}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setRoomStatus(data as RoomStatus))
      .catch(() => {/* aborted or network error — stay null */})
    return () => controller.abort()
  }, [code, mode])

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) onCreateRoom(name.trim(), playerCount, roundDuration)
  }

  const handleJoin = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim() && code.trim()) onJoinRoom(code.trim(), name.trim())
  }

  const statusBadge = () => {
    if (roomStatus === null || code.length < 4) return null
    if (roomStatus === 'loading') {
      return <p className="text-xs text-center" style={{ color: '#8a7880' }}>Verificando sala…</p>
    }
    if (!roomStatus.exists) {
      return <p className="text-xs text-center" style={{ color: '#c97070' }}>Sala não encontrada</p>
    }
    if (roomStatus.joinable) {
      return (
        <p className="text-xs text-center" style={{ color: 'var(--color-right)' }}>
          Aguardando jogadores ({roomStatus.currentPlayers}/{roomStatus.maxPlayers})
        </p>
      )
    }
    if (roomStatus.status === 'playing') {
      return <p className="text-xs text-center" style={{ color: '#c97070' }}>Partida em andamento</p>
    }
    return <p className="text-xs text-center" style={{ color: '#c97070' }}>Sala encerrada</p>
  }

  const joinDisabled =
    !name.trim() ||
    code.trim().length < 4 ||
    (roomStatus !== null && roomStatus !== 'loading' && !(roomStatus as RoomStatus).joinable)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 p-4">
      <div className="text-center relative">
        <h1 className="text-5xl font-bold tracking-[0.3em] mb-2">TERMO</h1>
        <p className="text-sm tracking-wider" style={{ color: '#8a7880' }}>DUELO EM TEMPO REAL</p>
        <button
          type="button"
          onClick={onHowToPlay}
          aria-label="Como jogar"
          style={{
            position: 'absolute', top: 0, right: -36,
            background: 'none', border: '1px solid #4c4347', borderRadius: '50%',
            width: 28, height: 28, cursor: 'pointer', color: '#8a7880',
            fontSize: '0.8rem', fontWeight: 'bold', lineHeight: 1,
          }}
        >
          ?
        </button>
      </div>

      <form
        onSubmit={mode === 'join' ? handleJoin : handleCreate}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <input
          type="text"
          placeholder="Seu nome"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={20}
          required
          className="game-input"
        />

        {mode === 'idle' && (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-widest text-center" style={{ color: '#8a7880' }}>
                Número de jogadores
              </p>
              <div className="flex gap-2">
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPlayerCount(n)}
                    className={playerCount === n ? 'btn-primary' : 'btn-outline'}
                    style={{ flex: 1, padding: '0.5rem' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-widest text-center" style={{ color: '#8a7880' }}>
                Tempo por rodada
              </p>
              <div className="flex gap-1 flex-wrap justify-center">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRoundDuration(n)}
                    className={roundDuration === n ? 'btn-primary' : 'btn-outline'}
                    style={{ width: '2.4rem', padding: '0.5rem 0', fontSize: '0.8rem' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-center" style={{ color: '#8a7880' }}>
                {roundDuration} {roundDuration === 1 ? 'minuto' : 'minutos'} por rodada
              </p>
            </div>

            <button
              type="submit"
              disabled={!name.trim()}
              className="btn-primary"
            >
              Criar Sala
            </button>

            <div className="flex items-center gap-3 my-1" style={{ color: '#4c4347' }}>
              <div className="flex-1 h-px" style={{ backgroundColor: '#4c4347' }} />
              <span className="text-xs">ou</span>
              <div className="flex-1 h-px" style={{ backgroundColor: '#4c4347' }} />
            </div>

            <button
              type="button"
              onClick={() => setMode('join')}
              className="btn-outline"
            >
              Entrar com Código
            </button>
          </>
        )}

        {mode === 'join' && (
          <>
            <input
              type="text"
              placeholder="CÓDIGO"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={4}
              required
              className="game-input text-center font-bold text-xl tracking-[0.4em]"
            />
            {statusBadge()}
            <button
              type="submit"
              disabled={joinDisabled}
              className="btn-primary"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setMode('idle'); setCode(''); setRoomStatus(null) }}
              className="text-sm text-center transition-colors"
              style={{ color: '#8a7880', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← Voltar
            </button>
          </>
        )}
      </form>
    </div>
  )
}
