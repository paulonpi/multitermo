import type { LobbyRoom } from '../types'

interface LobbyScreenProps {
  playerName: string
  rooms: LobbyRoom[]
  onJoin: (code: string) => void
  onCreateRoom: () => void
  onBack: () => void
}

export function LobbyScreen({ playerName, rooms, onJoin, onCreateRoom, onBack }: LobbyScreenProps) {
  return (
    <div className="flex flex-col items-center min-h-screen p-4 gap-6 max-w-sm mx-auto">

      <div className="w-full flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          style={{ color: '#8a7880', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Voltar
        </button>
        <h1 className="text-lg font-bold tracking-[0.2em]">SALAS ABERTAS</h1>
        <div style={{ width: 60 }} />
      </div>

      <p className="text-xs" style={{ color: '#8a7880' }}>
        Jogando como <span style={{ color: '#c4b5b9' }}>{playerName}</span>
      </p>

      <div className="w-full flex flex-col gap-3 flex-1">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16">
            <p className="text-sm text-center" style={{ color: '#8a7880' }}>
              Nenhuma sala aberta no momento.
            </p>
            <p className="text-xs text-center" style={{ color: '#4c4347' }}>
              Crie uma sala e aguarde outros jogadores.
            </p>
          </div>
        ) : (
          rooms.map(room => (
            <div
              key={room.code}
              className="flex items-center justify-between p-4 rounded-lg"
              style={{ background: '#2a1e22', border: '1px solid #3d2f34' }}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-semibold text-sm truncate" style={{ color: '#e0d0d4' }}>
                  {room.name}
                </span>
                <div className="flex gap-3 text-xs" style={{ color: '#8a7880' }}>
                  <span>{room.hostName}</span>
                  <span style={{ color: '#4c4347' }}>·</span>
                  <span style={{ color: room.players < room.maxPlayers ? 'var(--color-right)' : '#8a7880' }}>
                    {room.players}/{room.maxPlayers}
                  </span>
                  <span style={{ color: '#4c4347' }}>·</span>
                  <span>{room.roundDuration} min</span>
                </div>
              </div>
              <button
                onClick={() => onJoin(room.code)}
                className="btn-outline"
                style={{ width: 'auto', padding: '0.375rem 0.875rem', fontSize: '0.8rem', flexShrink: 0, marginLeft: '0.75rem' }}
              >
                Entrar
              </button>
            </div>
          ))
        )}
      </div>

      <button
        onClick={onCreateRoom}
        className="btn-primary w-full max-w-xs"
      >
        Criar sala pública
      </button>
    </div>
  )
}
