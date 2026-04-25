# RFC: Sistema de Ranking de Jogadores

## Contexto

O jogo é completamente anônimo — cada sessão usa apenas um nome temporário, sem histórico, sem pontuação acumulada entre partidas. Adicionar autenticação e ranking permite que jogadores frequentes acompanhem sua evolução, cria competição de longo prazo e aumenta retenção.

**Decisões já tomadas:**
- Auth: **Google OAuth** (sem senha, sem cadastro manual)
- Banco de dados: **SQLite + Drizzle ORM** (`better-sqlite3`; arquivo persistido em Docker volume)
- Guest mode: fluxo atual preservado — jogadores sem conta jogam normalmente, mas não entram no ranking
- Partidas que contam: apenas partidas onde **todos os jogadores são autenticados**

---

## Arquitetura

### Novos serviços e diretórios

```
server/src/
  auth/
  │ └── google.ts          ← passport-google-oauth20 + JWT
  db/
  │ ├── client.ts          ← Drizzle instance + better-sqlite3
  │ ├── schema.ts          ← tabelas: users, matches, match_players
  │ └── migrations/        ← gerado por drizzle-kit
  middleware/
  │ └── auth.ts            ← verifyJwt (para rotas REST)
  services/
  │ └── ranking.ts         ← cálculo ELO + persistência pós-partida

frontend/src/
  hooks/
  │ └── useAuth.ts         ← JWT storage, user state, login/logout
  screens/
  │ └── RankingScreen.tsx  ← leaderboard global + semanal
```

---

## Banco de Dados — Schema Drizzle

```typescript
// server/src/db/schema.ts

export const users = sqliteTable('users', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  googleId:      text('google_id').notNull().unique(),
  email:         text('email').notNull(),
  displayName:   text('display_name').notNull(),
  avatarUrl:     text('avatar_url'),
  rating:        integer('rating').notNull().default(1000),      // ELO acumulado (all-time)
  ratingWeekly:  integer('rating_weekly').notNull().default(0),  // delta desta semana
  matchesPlayed: integer('matches_played').notNull().default(0),
  matchesWon:    integer('matches_won').notNull().default(0),
  createdAt:     integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export const matches = sqliteTable('matches', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  roomCode:    text('room_code').notNull(),
  totalRounds: integer('total_rounds').notNull(),
  playedAt:    integer('played_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export const matchPlayers = sqliteTable('match_players', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  matchId:      integer('match_id').notNull().references(() => matches.id),
  userId:       integer('user_id').notNull().references(() => users.id),
  roundsWon:    integer('rounds_won').notNull(),
  placement:    integer('placement').notNull(),   // 1 = vencedor
  ratingBefore: integer('rating_before').notNull(),
  ratingDelta:  integer('rating_delta').notNull(),
})
```

---

## Auth — Google OAuth + JWT

### Fluxo

1. Frontend: botão "Entrar com Google" → `window.location.href = '/auth/google'`
2. Server: `GET /auth/google` → redirect para consent do Google via passport
3. Server: `GET /auth/google/callback` → troca code por perfil → cria/atualiza `users` → emite JWT → redireciona para `FRONTEND_URL?token=<jwt>`
4. Frontend: lê `?token=` da URL, salva em `localStorage('termo:token')`, remove da URL com `replaceState`
5. Frontend: em toda requisição autenticada e no handshake do socket, envia o token

### JWT

```typescript
// payload
{ sub: userId, name: displayName, picture: avatarUrl, iat, exp }
// expiração: 30 dias
```

### Socket.io — identificação do jogador

```typescript
// frontend/src/socket.ts
const socket = io(SERVER_URL, {
  auth: { token: localStorage.getItem('termo:token') ?? '' }
})

// server — middleware no socket.io
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (token) {
    try {
      socket.data.user = verifyJwt(token)  // { sub, name, picture }
    } catch {
      // token inválido → continua como guest (não rejeita)
    }
  }
  next()
})
```

Guest: `socket.data.user` é `undefined`. Jogador autenticado: `socket.data.user.sub` = userId.

### Extensão de `Player` (room.ts)

```typescript
interface Player {
  socketId: string
  name: string
  score: number
  userId?: number   // ← novo: undefined = guest
}
```

Ao criar/entrar na sala, o handler popula `player.userId = socket.data.user?.sub` se disponível.

---

## ELO Multiplayer

### Fórmula

```
Para N jogadores, cada um com placement P (1 = melhor):
  A (actual score)   = (N - P) / (N - 1)
  E (expected score) = média de P(bater cada oponente)
                     = média de [ 1 / (1 + 10^((Roponente - Rpróprio) / 400)) ]
  ΔR = K × (A - E)   com K = 32
  Rating inicial = 1000
```

Para 2 jogadores: vencedor ganha A=1, perdedor A=0 — equivale ao ELO clássico.  
Em caso de empate (mesmo nº de rodadas ganhas): ambos recebem A=0.5.

### Implementação

```typescript
// server/src/services/ranking.ts

export function calculateElo(
  players: Array<{ userId: number; rating: number; roundsWon: number }>
): Array<{ userId: number; delta: number }> { ... }

export async function persistMatch(
  db: DrizzleDb,
  roomCode: string,
  totalRounds: number,
  players: Array<{ userId: number; roundsWon: number }>
): Promise<void> {
  // 1. Busca ratings atuais
  // 2. Calcula placements (sort por roundsWon desc)
  // 3. Calcula ELO deltas
  // 4. INSERT matches
  // 5. INSERT match_players (um por jogador)
  // 6. UPDATE users (rating, ratingWeekly, matchesPlayed, matchesWon)
}
```

### Quando disparar

Em `handlers.ts`, dentro de `resolveRound()`, após emitir `match_end`:

```typescript
// Só persiste se TODOS os jogadores são autenticados
const allAuth = room.players.every(p => p.userId != null)
if (allAuth) {
  await persistMatch(db, room.code, room.totalRounds,
    room.players.map(p => ({ userId: p.userId!, roundsWon: p.score }))
  )
}
```

O `match_end` continua sendo emitido para todos (autenticados ou não), garantindo que o jogo funcione para guests sem alterações.

---

## Rotas REST

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/auth/google` | — | Redirect OAuth |
| `GET` | `/auth/google/callback` | — | Callback OAuth → JWT |
| `GET` | `/api/me` | JWT | Perfil do usuário logado |
| `GET` | `/api/ranking` | — | Top 50 all-time por `rating` |
| `GET` | `/api/ranking/weekly` | — | Top 50 da semana por `ratingWeekly` |
| `GET` | `/api/players/:id` | — | Perfil público + últimas 10 partidas |

### Resposta `/api/ranking`
```json
[{ "rank": 1, "displayName": "...", "avatarUrl": "...", "rating": 1243, "matchesPlayed": 42, "matchesWon": 28 }]
```

### Resposta `match_end` (extendida quando todos autenticados)
```typescript
// server → client
{
  winnerName: string | null,
  scores: { name: string; score: number }[],
  eloDeltas?: { name: string; delta: number }[]  // ← novo, só se partida contou
}
```

---

## Reset Semanal

`node-cron` registrado em `server/src/index.ts`:

```typescript
import cron from 'node-cron'
// Toda segunda-feira às 00:00 UTC
cron.schedule('0 0 * * 1', async () => {
  await db.update(users).set({ ratingWeekly: 0 })
})
```

---

## Frontend — Mudanças

### `useAuth.ts` (novo)

```typescript
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    // Lê token da URL (retorno OAuth) ou localStorage
    // Decodifica payload JWT (sem verificar assinatura — só para display)
    // Armazena em localStorage('termo:token')
  }, [])

  return { user, logout: () => { localStorage.removeItem('termo:token'); setUser(null) } }
}
```

### `HomeScreen.tsx` — adições

- Se não logado: botão "Entrar com Google" (secundário, abaixo dos botões principais)
- Se logado: avatar + nome + botão "Sair" no canto superior; link "Ranking"
- Fluxo existente (nome + criar/entrar sala) permanece inalterado para todos

### `RankingScreen.tsx` (novo)

- Aba "Geral" (all-time) e "Semana" (weekly)
- Tabela: posição, avatar, nome, rating, partidas, vitórias
- Destaca linha do jogador logado
- Botão "Voltar" → HomeScreen

### `MatchEndScreen.tsx` — adições

- Se `eloDeltas` presente: mostra `+12 ★` ou `−8 ★` ao lado do score de cada jogador

### `App.tsx` — novo case

```tsx
case 'ranking':
  return <RankingScreen onBack={() => setState(s => ({ ...s, screen: 'home' }))} />
```

---

## Variáveis de Ambiente

```env
# .env / .env.prod (novos campos)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://seudominio.com/auth/google/callback
JWT_SECRET=...              # string aleatória longa
DATABASE_PATH=/data/termo.db
FRONTEND_URL=https://seudominio.com
```

---

## Docker — Volume SQLite

```yaml
# docker-compose.prod.yml (adição)
services:
  server:
    volumes:
      - sqlite_data:/data

volumes:
  sqlite_data:
```

Em desenvolvimento (`docker-compose.yml`): bind mount local `./data:/data` para inspeção fácil.

---

## Novas Dependências

```
server — runtime:
  drizzle-orm, better-sqlite3, passport, passport-google-oauth20, jsonwebtoken, node-cron

server — dev:
  drizzle-kit, @types/better-sqlite3, @types/passport, @types/passport-google-oauth20,
  @types/jsonwebtoken, @types/node-cron
```

---

## Arquivos Modificados / Criados

| Arquivo | Mudança |
|---|---|
| `server/src/db/client.ts` | **novo** — Drizzle + better-sqlite3 |
| `server/src/db/schema.ts` | **novo** — tabelas users, matches, match_players |
| `server/src/auth/google.ts` | **novo** — passport setup + JWT emit |
| `server/src/middleware/auth.ts` | **novo** — verifyJwt para rotas REST |
| `server/src/services/ranking.ts` | **novo** — calculateElo + persistMatch |
| `server/src/index.ts` | auth routes, ranking routes, socket middleware, cron |
| `server/src/socket/handlers.ts` | socket.data.user; Player.userId; persistMatch pós match_end |
| `server/src/game/room.ts` | `Player.userId?: number` |
| `server/src/types.ts` | AuthUser type |
| `frontend/src/hooks/useAuth.ts` | **novo** — JWT storage + user state |
| `frontend/src/screens/RankingScreen.tsx` | **novo** — leaderboard |
| `frontend/src/App.tsx` | case 'ranking'; passa user para HomeScreen |
| `frontend/src/screens/HomeScreen.tsx` | login button, user avatar, ranking link |
| `frontend/src/screens/MatchEndScreen.tsx` | ELO delta display |
| `frontend/src/hooks/useGame.ts` | screen 'ranking' no GameState.Screen |
| `frontend/src/socket.ts` | auth: { token } no handshake |
| `docker-compose.yml` | bind mount `./data:/data` |
| `docker-compose.prod.yml` | volume sqlite_data |

---

## Testes

### Unitários (`server/src/services/__tests__/ranking.test.ts`)
- `calculateElo` — 2 jogadores: vencedor ganha ~+16, perdedor −16 (K=32, ratings iguais)
- `calculateElo` — favorito (rating alto) vence: ganho menor; zebra: ganho maior
- `calculateElo` — 3 jogadores: soma dos deltas ≈ 0
- `calculateElo` — empate entre 2: delta ≈ 0

### Verificação manual
1. Fazer login com Google → token salvo, nome/avatar aparece na HomeScreen
2. Criar sala com conta autenticada + segundo jogador autenticado → jogar partida completa
3. Ao final: `match_end` inclui `eloDeltas` → MatchEndScreen mostra `+X ★`
4. Acessar `/api/ranking` → jogadores aparecem com ratings atualizados
5. Criar sala com um guest → jogar → `match_end` sem `eloDeltas` → ratings inalterados
6. Recarregar página → usuário continua logado (token em localStorage)
7. Segunda-feira (ou forçar cron): `ratingWeekly` resetado → ranking semanal zerado
