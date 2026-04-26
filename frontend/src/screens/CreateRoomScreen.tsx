import { useState, type FormEvent } from 'react'

interface CreateRoomScreenProps {
  playerName: string
  onBack: () => void
  onCreateRoom: (playerName: string, maxPlayers: number, roundDuration: number, isPublic: boolean, roomName: string) => void
}

export function CreateRoomScreen({ playerName, onBack, onCreateRoom }: CreateRoomScreenProps) {
  const [isPublic, setIsPublic] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [playerCount, setPlayerCount] = useState(2)
  const [roundDuration, setRoundDuration] = useState(3)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isPublic && !roomName.trim()) return
    onCreateRoom(playerName, playerCount, roundDuration, isPublic, roomName.trim())
  }

  const submitDisabled = isPublic && !roomName.trim()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
      <div className="w-full max-w-xs flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          style={{ color: '#8a7880', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Voltar
        </button>
        <h1 className="text-lg font-bold tracking-[0.2em]">CRIAR SALA</h1>
        <div style={{ width: 60 }} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full max-w-xs">

        {/* Visibilidade */}
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-widest text-center" style={{ color: '#8a7880' }}>
            Visibilidade
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={!isPublic ? 'btn-primary' : 'btn-outline'}
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
            >
              Privada
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={isPublic ? 'btn-primary' : 'btn-outline'}
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
            >
              Pública
            </button>
          </div>
          <p className="text-xs text-center" style={{ color: '#8a7880' }}>
            {isPublic ? 'Aparece na lista de salas abertas' : 'Acesso apenas por código'}
          </p>
        </div>

        {/* Nome da sala (só público) */}
        {isPublic && (
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-widest text-center" style={{ color: '#8a7880' }}>
              Nome da sala
            </p>
            <input
              type="text"
              placeholder="Ex: Sala do Paulo"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              maxLength={30}
              required
              className="game-input"
            />
          </div>
        )}

        {/* Número de jogadores */}
        <div className="flex flex-col gap-2">
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

        {/* Duração da rodada */}
        <div className="flex flex-col gap-2">
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
          disabled={submitDisabled}
          className="btn-primary"
        >
          Criar Sala
        </button>
      </form>
    </div>
  )
}
