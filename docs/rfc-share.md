# RFC: Shareable Match Result

## Contexto

Ao final de uma partida não há forma de compartilhar o resultado. Adicionar um link compartilhável cria um loop viral: vencedor compartilha → amigo vê o resultado → clica em "Jogar agora" → nova partida.

**Decisões tomadas:**
- **Zero banco de dados** — resultado codificado em base64 no query string (`?d=`)
- **Todos compartilham** — guests e autenticados (nome de exibição apenas)
- **CTA do link** — "Jogar agora" redireciona para a HomeScreen (`/`)
- **Formatos MVP** — texto estilo Wordle, share nativo mobile, OG tags para WhatsApp/Discord

---

## Arquitetura

### Problema: OG tags + SPA

Tags `og:title/description` precisam estar no HTML antes do JS carregar (scrapers do WhatsApp não executam JS). O React SPA não pode injetar OG tags dinamicamente para scrapers.

**Solução**: a share page é um HTML simples server-side renderizado pelo Express — sem o React app. O Express lê o `?d=` param, decodifica o payload e serve HTML completo com OG tags corretos.

```
Usuário compartilha link
        ↓
Caddy → /share* → Express → HTML com OG tags + resultado
        ↓
WhatsApp scraper vê og:title/description ✓
Visitante humano vê página de resultado + botão "Jogar agora" ✓
```

---

## Payload — Formato do Link

```typescript
interface SharePayload {
  w: string | null           // winner name (null = empate)
  s: { n: string; r: number }[]  // scores: name + rounds won, sorted desc
  t: number                  // total rounds
}
```

**Serialização**: `btoa(JSON.stringify(payload))` (URL-safe base64)

**Exemplo de URL**:
```
https://multitermo.vitreon.tech/share?d=eyJ3IjoiUGF1bG8iLCJzIjpbeyJuIjoiUGF1bG8iLCJyIjozfSx7Im4iOiJBbmEiLCJyIjoyfV0sInQiOjV9
```
(~180 chars total — fine para WhatsApp)

---

## Share Text (Estilo Wordle)

Gerado no frontend, copiado pelo usuário:

```
🏆 Paulo venceu o Termo!

1º Paulo — 3/5 rodadas
2º Ana   — 2/5 rodadas

Jogue agora: https://multitermo.vitreon.tech/share?d=...
```

**Empate**:
```
🤝 Empate no Termo!

🥇 Paulo — 2/4 rodadas
🥇 Ana   — 2/4 rodadas

Jogue agora: https://...
```

---

## Share Page — HTML Server-Side

Servido pelo Express em `GET /share`. Usa Tailwind CDN para estilos (zero build step).

**OG Tags**:
```html
<meta property="og:title" content="Paulo venceu o Termo Multiplayer!" />
<meta property="og:description" content="1º Paulo (3 rodadas) · 2º Ana (2 rodadas) · Jogue agora!" />
<meta property="og:url" content="https://multitermo.vitreon.tech/share?d=..." />
<meta property="og:image" content="https://multitermo.vitreon.tech/og-image.png" />
<meta name="twitter:card" content="summary" />
```

**Layout da página**:
```
┌─────────────────────────────┐
│           TERMO              │
│      Duelo em Tempo Real     │
├─────────────────────────────┤
│   🏆 Paulo venceu!          │
│                             │
│   1º Paulo    3 rodadas     │
│   2º Ana      2 rodadas     │
│                             │
│   [ Jogar agora ]           │
│   [ Compartilhar ]          │
└─────────────────────────────┘
```

Botão "Jogar agora" → `href="/"` (HomeScreen)  
Botão "Compartilhar" → copia URL para clipboard

**Validação server-side**: se `?d=` ausente, inválido ou payload malformado → redireciona para `/`.

---

## Botão de Compartilhamento — MatchEndScreen

Adicionado abaixo dos scores na tela de fim de partida.

**Comportamento**:
1. Gera o payload e a URL de share
2. Tenta `navigator.share()` (mobile nativo) com title + text + url
3. Se `navigator.share` não disponível (desktop) → copia link para clipboard + mostra toast "Link copiado!"

**Botão condicional**: aparece somente se o jogador local for o vencedor (ou em caso de empate — para todos). Guests e autenticados recebem o botão igualmente.

---

## Roteamento — Caddyfile

```caddy
multitermo.vitreon.tech {
    handle /share* {
        reverse_proxy termo-server:3001
    }
    handle /socket.io/* {
        reverse_proxy termo-server:3001
    }
    handle {
        reverse_proxy termo-frontend:80
    }
}
```

---

## OG Image Estática

Criar `frontend/public/og-image.png` — imagem 1200×630 px com branding do jogo.  
Sem geração dinâmica no MVP (imagem genérica serve para o preview).

---

## Arquivos Modificados / Criados

| Arquivo | Mudança |
|---|---|
| `server/src/routes/share.ts` | **novo** — Express route que gera HTML com OG tags |
| `server/src/index.ts` | registrar rota `/share` |
| `frontend/src/screens/MatchEndScreen.tsx` | botão de compartilhamento |
| `frontend/public/og-image.png` | **novo** — imagem estática para preview |
| `Caddyfile` | adicionar `handle /share*` antes do handle genérico |

Não há novos arquivos no frontend além de `MatchEndScreen.tsx` — a share page é renderizada pelo servidor, não pelo React.

---

## Segurança

- Payload é read-only (não há como falsificar um resultado que o servidor valide — o servidor apenas renderiza o que recebe)
- Só expõe nomes de exibição (sem email, sem ID interno)
- Validação básica: payload deve ser JSON válido com campos esperados; qualquer erro redireciona para `/`

---

## Casos de Borda

| Caso | Comportamento |
|---|---|
| Empate | Texto: "🤝 Empate entre Paulo e Ana!" · Ranking mostra 🥇 para todos com o mesmo score |
| Nome muito longo | Truncado em 20 chars (mesmo limite do input de nome) |
| Payload corrompido | Express redireciona para `/` |
| `?d=` ausente | Express redireciona para `/` |

---

## Verificação Manual

1. Jogar partida completa → `MatchEndScreen` mostra botão de compartilhamento
2. Clicar botão no mobile → menu nativo de share abre com texto formatado
3. Clicar botão no desktop → toast "Link copiado!" aparece
4. Abrir link em nova aba → share page renderiza com resultado correto
5. Colar link no WhatsApp → preview mostra título e descrição com o resultado
6. Clicar "Jogar agora" na share page → vai para HomeScreen
7. Link com `?d=` inválido → redireciona para `/` sem erro
