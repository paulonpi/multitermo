# RFC: Lobby — Salas Públicas

## Contexto

Atualmente só existem salas privadas (código de 4 letras). O lobby adiciona salas públicas visíveis em lista, permitindo que jogadores se encontrem sem combinar um código.

**Decisões tomadas:**
- Salas públicas coexistem com as privadas (nenhum fluxo atual é removido)
- A lista atualiza em tempo real via socket.io
- A partida começa automaticamente quando a sala enche
- O host pode excluir a sala enquanto aguarda
- Se o host desconectar, o próximo jogador na lista vira host
- O jogador precisa digitar nome antes de ver o lobby

---

## Novos Campos no Room

```typescript
interface Room {
  // ... campos existentes ...
  isPublic: boolean       // true = sala visível no lobby
  roomName: string        // nome definido pelo host (ex: "Sala do Paulo")
  hostSocketId: string    // socket do host atual
}
```

---

## Novo Tipo — LobbyRoom

Projeção leve enviada aos clientes na lista:

```typescript
interface LobbyRoom {
  code: string
  name: string        // nome da sala
  hostName: string
  players: number     // atual
  maxPlayers: number
  roundDuration: number
}
```

---

## Redis

- `room:{code}` — estrutura existente + `isPublic`, `roomName`, `hostSocketId`
- `lobby:rooms` — Redis Set com os códigos de salas públicas em status `waiting`
  - Adicionado quando sala pública é criada
  - Removido quando: jogo inicia, sala é deletada, último jogador sai

---

## Novos Eventos Socket.io

### Cliente → Servidor

| Evento | Payload | Descrição |
|---|---|---|
| `create_room` | `{ playerName, roomName?, isPublic, maxPlayers, roundDuration }` | Estende evento existente |
| `browse_lobby` | — | Entra no canal `'lobby'`, recebe lista atual |
| `leave_lobby` | — | Sai do canal `'lobby'` |
| `delete_room` | — | Host exclui a sala (só aceito se sender é host) |

### Servidor → Cliente

| Evento | Payload | Destinatário | Descrição |
|---|---|---|---|
| `lobby_update` | `LobbyRoom[]` | canal `'lobby'` | Lista completa sempre que algo muda |
| `room_deleted` | — | membros da sala | Sala foi deletada pelo host |
| `host_changed` | `{ hostName: string }` | membros da sala | Novo host após desconexão |

---

## Fluxo de Host Transfer

1. Host desconecta (`disconnect`)
2. Handler existente de `player_left` remove o jogador
3. Se a sala ainda tem jogadores e `room.hostSocketId === socket.id`:
   - `room.hostSocketId = room.players[0].socketId`
   - Emite `host_changed` para os que restaram
   - Atualiza `lobby:rooms` e emite `lobby_update`
4. Se a sala ficou vazia: remove `room:{code}` e `lobby:rooms`

---

## Fluxo de Exclusão de Sala

1. Host emite `delete_room`
2. Servidor valida que `socket.id === room.hostSocketId`
3. Deleta `room:{code}` do Redis
4. Remove da `lobby:rooms`
5. Emite `room_deleted` para todos na sala
6. Emite `lobby_update` para canal `'lobby'`

---

## Alterações no Frontend

### HomeScreen

Dois novos botões abaixo dos existentes (ou reestruturação visual):

```
[ Criar sala privada ]   (fluxo atual — sem nome de sala)
[ Ver salas públicas ]   → LobbyScreen
```

No formulário "Criar sala":
- Toggle **Pública / Privada**
- Se pública: campo extra "Nome da sala" (obrigatório, max 30 chars)
- Se privada: sem campo de nome (como hoje)

### Nova tela — LobbyScreen

- Lista de cards (`LobbyRoom[]`) atualizada em tempo real
- Card: nome da sala · host · `X/Y jogadores` · `N min`
- Botão "Entrar" em cada card → emite `join_room` com o código
- Botão "Criar sala pública" → abre formulário de criação com `isPublic: true`
- Se lista vazia: mensagem "Nenhuma sala aberta no momento"

### WaitingScreen

- Exibe o nome da sala (se pública)
- Botão **Excluir sala** visível somente se `isHost === true`
  - Clique emite `delete_room`

### GameState (useGame.ts)

Novos campos:

```typescript
isHost: boolean        // true se eu sou o host atual
roomName: string       // nome da sala (vazio para privadas)
isPublic: boolean
lobbyRooms: LobbyRoom[]
```

Novos eventos tratados:
- `lobby_update` → atualiza `lobbyRooms`
- `room_deleted` → volta para home com toast "Sala excluída pelo host"
- `host_changed` → atualiza `isHost` se meu nome === novo host

Nova Screen: `'lobby'`

---

## Arquivos Modificados / Criados

| Arquivo | Mudança |
|---|---|
| `server/src/types.ts` | `isPublic`, `roomName`, `hostSocketId` no Room; novo `LobbyRoom` |
| `server/src/game/room.ts` | `createRoom` recebe `isPublic`, `roomName`; lógica de `lobby:rooms` |
| `server/src/socket/handlers.ts` | `browse_lobby`, `leave_lobby`, `delete_room`; host transfer; lobby_update trigger |
| `frontend/src/types.ts` | `LobbyRoom`; Screen += `'lobby'`; `isHost`, `roomName`, `isPublic`, `lobbyRooms` no GameState |
| `frontend/src/hooks/useGame.ts` | Novos campos de estado; handlers para `lobby_update`, `room_deleted`, `host_changed` |
| `frontend/src/screens/HomeScreen.tsx` | Toggle público/privado; campo nome de sala; botão "Ver salas públicas" |
| `frontend/src/screens/LobbyScreen.tsx` | **novo** — lista de salas em tempo real |
| `frontend/src/screens/WaitingScreen.tsx` | Nome da sala; botão "Excluir sala" se isHost |
| `frontend/src/App.tsx` | Case `'lobby'` → `LobbyScreen` |
| `server/src/game/__tests__/room.test.ts` | Testes para campos novos |

---

## Testes (TDD)

### server/src/game/__tests__/room.test.ts

- `createRoom` com `isPublic: true` salva `roomName` e `hostSocketId`
- `createRoom` com `isPublic: false` não adiciona a `lobby:rooms`
- `createRoom` com `isPublic: true` adiciona código a `lobby:rooms`
- `joinRoom` ainda funciona para salas públicas

### server/src/socket/__tests__/lobbyHandlers.test.ts (novo)

- `browse_lobby` junta socket ao canal e recebe `lobby_update` com lista atual
- `delete_room` por não-host é ignorado
- `delete_room` por host deleta sala e emite `room_deleted` + `lobby_update`
- Desconexão do host promove próximo jogador e emite `host_changed`
- Sala removida de `lobby:rooms` quando jogo inicia

---

## Casos de Borda

| Caso | Comportamento |
|---|---|
| Host exclui sala com jogadores dentro | Todos voltam para home com toast |
| Jogador tenta entrar em sala que acabou de encher | `join_room` retorna null → toast "Sala cheia" |
| Último jogador sai (não-host) antes de encher | Sala some do lobby; Redis limpo |
| Nome de sala vazio ao criar pública | Frontend valida antes de emitir |
| Sala pública: host desconecta, 0 jogadores restam | Sala removida do Redis e do lobby |
