# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Termo Multiplayer** — real-time multiplayer version of [term.ooo](https://term.ooo) (Portuguese Wordle). Two players compete in the same room, each guessing the same 5-letter word simultaneously. A match has **5 rounds**; the player who wins the most rounds wins the match.

## Game Rules

- 5-letter Portuguese words, 6 attempts per round
- Tile feedback: **green** = right letter, right position; **yellow** = right letter, wrong position; **gray** = letter not in word
- Accents are auto-filled and ignored in feedback logic
- Words may have repeated letters
- 5 rounds per match; best-of-5 wins
- Each round uses the same word for both players (chosen randomly by the server at round start)
- Opponent progress is visible (colored dots per attempt, no letters revealed) in real time

## Architecture

```
frontend/   React SPA (Vite + TypeScript)
server/     Node.js + socket.io + Redis
words.json  Static PT-BR word list (loaded into memory at startup)
```

```
Browser A ──WebSocket──┐
                        ├── Node.js server ── Redis (match state)
Browser B ──WebSocket──┘
```

**State in Redis:**
- Room: `room:{code}` — players, current round, scores, word, guesses per player, status
- Rooms are ephemeral (TTL ~30 min after last activity)

**socket.io events (client → server):** `join_room`, `submit_guess`
**socket.io events (server → client):** `room_joined`, `game_start`, `round_start`, `guess_result`, `opponent_progress`, `round_end`, `match_end`

Word list (`words.json`) lives in `server/` and is loaded once at startup — the client never fetches it directly.

**Word list source:** [`fserb/pt-br`](https://github.com/fserb/pt-br) — the same corpus used by term.ooo. The `lexico` file contains ~145k entries, one word per line, with accents. At startup the server filters it to words with exactly 5 letters (after stripping accents for length counting), producing two sets:
- **answer pool** — common words only (filter by ICF score from the `icf` file, lower score = more common)
- **valid guesses** — all 5-letter words (for accepting attempts without rejecting obscure words)

## Local Development

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Server (socket.io): http://localhost:3001
- Redis: localhost:6379

```bash
# frontend only (hot reload outside Docker)
cd frontend && npm install && npm run dev

# server only
cd server && npm install && npm run dev
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Real-time | socket.io (client + server) |
| Backend | Node.js + TypeScript |
| State | Redis (ioredis) |
| Reverse proxy | Caddy |
| Containers | Docker Compose |

## Docker Compose

- **`docker-compose.yml`** — local dev (volumes mounted for hot reload, ports exposed)
- **`docker-compose.prod.yml`** — production (Caddy + restart policies, no exposed Redis port)

Services: `frontend`, `server`, `redis`, `caddy` (prod only).

## CI/CD & Deployment

Mirrors the PyCatalog/Vitreon setup:

- **VPS:** Hostinger KVM2 — project lives at `/opt/termo`
- **Reverse proxy:** Caddy (auto HTTPS)
- **Branch flow:** `feature/x` → `develop` → `main`
  - Push to `main` → GitHub Actions SSH deploys to VPS (production)
- **Deploy script (runs on VPS via SSH):**
  ```bash
  cd /opt/termo
  git pull origin main
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
  docker system prune -f
  ```
- **GitHub Secrets:** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

## Environment Variables

`.env` (dev) / `.env.prod` (production):

```env
REDIS_URL=redis://redis:6379
PORT=3001
CORS_ORIGIN=http://localhost:5173   # prod: https://yourdomain.com
```

Frontend build args:
```env
VITE_SERVER_URL=http://localhost:3001   # prod: wss://yourdomain.com
```
