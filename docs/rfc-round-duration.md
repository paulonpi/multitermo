# RFC: Duração Configurável de Rodada

## Contexto

O timer de cada rodada é fixo em 5 minutos hardcoded. Dar ao host controle sobre o ritmo da partida permite estilos de jogo diferentes — desde duelos rápidos de 1 minuto até partidas mais tranquilas de 10 minutos.

**Decisões tomadas:**
- **Range**: 1 a 10 minutos inteiros
- **Default**: 3 minutos (mais dinâmico que os 5 atuais)
- **Granularidade**: botões de 1 em 1 minuto (mesmo estilo do seletor de nº de jogadores)
- **Sons de tick**: thresholds adaptam à duração — sem ticks espúrios em rounds curtos

---

## Stack — Adaptações ao RFC Original

O RFC original menciona `POST /rooms` (REST) e "Rooms Table" (banco de dados). O jogo usa:
- **Socket.io** para criação de sala (`create_room` event)
- **Redis** para estado da sala (sem tabela relacional)

O RFC foi adaptado para essas realidades.

---

## Backend

### Constante atual (a remover)

```typescript
// server/src/socket/handlers.ts
const ROUND_DURATION_MS = 5 * 60 * 1000  // ← remover
```

### Evento `create_room` (socket.io)

```typescript
// Payload atual
{ playerName: string; maxPlayers: number }

// Payload novo
{ playerName: string; maxPlayers: number; roundDuration?: number }
```

**Validação server-side**:
```typescript
const roundDuration = Math.min(10, Math.max(1, Math.round(data.roundDuration ?? 3)))
```

### Room state (Redis)

Adicionar campo ao objeto da sala:

```typescript
interface Room {
  // ...campos existentes...
  roundDuration: number  // minutos, 1–10, default 3
}
```

### Evento `round_start` (server → client)

```typescript
// Já enviado, adicionar roundDuration:
io.to(room.code).emit('round_start', {
  round,
  totalRounds,
  roundEndTime,       // existente
  roundDuration: room.roundDuration,  // ← novo
})
```

### Evento `room_joined` / `room_created` (server → client)

Incluir `roundDuration` no payload para exibição no WaitingScreen.

---

## Frontend

### `HomeScreen.tsx` — Seletor de duração

Adicionado abaixo do seletor de número de jogadores, com o mesmo estilo de botões:

```
Tempo por rodada
[ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ] [ 6 ] [ 7 ] [ 8 ] [ 9 ] [10]
```

Estado local: `const [roundDuration, setRoundDuration] = useState(3)`  
Enviado em `create_room`: `{ playerName, maxPlayers, roundDuration }`

### `WaitingScreen.tsx` — Exibição da configuração

```
Aguardando jogadores (1/2)
Tempo por rodada: 3 min
```

Props novas: `roundDuration: number`

### `GameScreen.tsx` / `useGame.ts` — Sem mudanças na lógica do timer

O `roundEndTime` já é calculado pelo servidor e enviado no `round_start`. O countdown no cliente continua funcionando da mesma forma.

### Sons de tick — Thresholds adaptativos

Os thresholds atuais são fixos: `[60, 30, 10, 5, 4, 3, 2, 1]`. Em rounds de 1 minuto, o tick de 60s dispara no segundo 0 da rodada (inútil).

**Nova lógica**: thresholds filtrados pela duração da rodada:

```typescript
// useGame.ts
const roundSecs = roundDuration * 60

// Thresholds ativos = apenas os menores que a duração do round
const TIMER_THRESHOLDS = [60, 30, 10, 5, 4, 3, 2, 1].filter(t => t < roundSecs)
// Ex: roundDuration=1 (60s) → thresholds: [10, 5, 4, 3, 2, 1]
// Ex: roundDuration=2 (120s) → thresholds: [60, 10, 5, 4, 3, 2, 1]
// Ex: roundDuration=5 (300s) → thresholds: [60, 30, 10, 5, 4, 3, 2, 1] (todos)
```

O `roundDuration` precisa estar no `GameState` (já vem no `round_start`).

---

## Tipos — Mudanças

```typescript
// frontend/src/types.ts
// Sem alterações de tipo exportado — roundDuration é transportado internamente

// frontend/src/hooks/useGame.ts
interface GameState {
  // ...campos existentes...
  roundDuration: number  // minutos, para filtrar thresholds de tick
}
```

---

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `server/src/socket/handlers.ts` | ler `roundDuration` do `create_room`; validar; usar em vez de constante hardcoded |
| `server/src/game/room.ts` | `Room.roundDuration: number`; incluir em `createRoom()` |
| `frontend/src/screens/HomeScreen.tsx` | seletor de duração (botões 1–10) |
| `frontend/src/screens/WaitingScreen.tsx` | exibir "Tempo por rodada: X min" |
| `frontend/src/hooks/useGame.ts` | `roundDuration` no GameState; thresholds adaptativos |

---

## Backward Compatibility

- Se `roundDuration` ausente no `create_room`: servidor usa 3 minutos
- Salas criadas antes do deploy continuam funcionando (Redis TTL ~1h; ao expirar, novas salas usam o novo default)

---

## Verificação

1. Criar sala com duração de 1 min → rodada dura exatamente 1 min
2. WaitingScreen mostra "Tempo por rodada: 1 min" para todos os jogadores
3. Sons de tick em round de 1 min: apenas ≤10s disparam (60s e 30s ignorados)
4. Criar sala com duração de 10 min → todos os ticks disparam normalmente
5. Omitir `roundDuration` no create_room → default 3 min aplicado
6. Enviar `roundDuration=99` → servidor clipa para 10
7. Enviar `roundDuration=-1` → servidor clipa para 1
