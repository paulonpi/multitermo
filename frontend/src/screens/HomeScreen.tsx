import { useState, type FormEvent } from 'react'

interface HomeScreenProps {
  onCreateRoom: (name: string, maxPlayers: number) => void
  onJoinRoom: (code: string, name: string) => void
}

export function HomeScreen({ onCreateRoom, onJoinRoom }: HomeScreenProps) {
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

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) onCreateRoom(name.trim(), playerCount)
  }

  const handleJoin = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim() && code.trim()) onJoinRoom(code.trim(), name.trim())
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 p-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-[0.3em] mb-2">TERMO</h1>
        <p className="text-sm tracking-wider" style={{ color: '#8a7880' }}>DUELO EM TEMPO REAL</p>
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
            <button
              type="submit"
              disabled={!name.trim() || code.trim().length < 4}
              className="btn-primary"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
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
