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
  onCreateRoom: (name: string) => void
  onOpenLobby: (name: string) => void
  onJoinRoom: (code: string, name: string) => void
  onHowToPlay: () => void
}

export function HomeScreen({ onCreateRoom, onOpenLobby, onJoinRoom, onHowToPlay }: HomeScreenProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(() => {
    const params = new URLSearchParams(location.search)
    return params.get('room')?.toUpperCase() ?? ''
  })
  const [mode, setMode] = useState<'idle' | 'join'>(() => {
    const params = new URLSearchParams(location.search)
    return params.get('room') ? 'join' : 'idle'
  })
  const [roomStatus, setRoomStatus] = useState<RoomStatus | 'loading' | null>(null)

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
      .catch(() => {})
    return () => controller.abort()
  }, [code, mode])

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

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <input
          type="text"
          placeholder="Seu nome"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={20}
          className="game-input"
        />

        {mode === 'idle' && (
          <>
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => onCreateRoom(name.trim())}
              className="btn-primary"
            >
              Criar Sala
            </button>

            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => onOpenLobby(name.trim())}
              className="btn-outline"
            >
              Salas Públicas
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
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
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
          </form>
        )}
      </div>
    </div>
  )
}
