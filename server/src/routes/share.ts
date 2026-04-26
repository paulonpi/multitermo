import type { Request, Response } from 'express'

export interface SharePayload {
  w: string | null
  s: { n: string; r: number }[]
  t: number
}

export function decodePayload(encoded: string): SharePayload | null {
  if (!encoded) return null
  try {
    const json = decodeURIComponent(Buffer.from(encoded, 'base64').toString())
    const p = JSON.parse(json)
    if (typeof p !== 'object' || p === null) return null
    if (!('w' in p) || !Array.isArray(p.s) || typeof p.t !== 'number') return null
    return p as SharePayload
  } catch {
    return null
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function buildOgTitle(payload: SharePayload): string {
  if (payload.w !== null) {
    return `🏆 ${payload.w} venceu o Termo!`
  }
  return '🤝 Empate no Termo!'
}

export function buildOgDescription(payload: SharePayload): string {
  return payload.s
    .map((entry, i) => {
      const medal = payload.w === null ? '🥇' : i === 0 ? '🥇' : `${i + 1}º`
      return `${medal} ${entry.n} — ${entry.r}/${payload.t} rodadas`
    })
    .join(' · ')
}

export function renderShareHtml(payload: SharePayload, shareUrl: string): string {
  const title = escapeHtml(buildOgTitle(payload))
  const description = escapeHtml(buildOgDescription(payload))
  const safeUrl = escapeHtml(shareUrl)

  const rows = payload.s
    .map((entry, i) => {
      const medal = payload.w === null ? '🥇' : i === 0 ? '🥇' : `${i + 1}º`
      return `<p style="margin:0.25rem 0;font-size:1.1rem;color:#c4b5b9;">${medal} ${escapeHtml(entry.n)} — ${entry.r}/${payload.t}</p>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <style>
    body { background:#1a1215; color:#e0d0d4; font-family:system-ui,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:1.5rem; box-sizing:border-box; }
    h1 { font-size:1.8rem; font-weight:700; margin:0 0 1.5rem; letter-spacing:.05em; }
    .scores { margin-bottom:2rem; text-align:center; }
    a.cta { background:#6b4c55; color:#fff; padding:.75rem 2rem; border-radius:.5rem; text-decoration:none; font-weight:600; font-size:1rem; }
    a.cta:hover { background:#7d5a64; }
    .brand { font-size:.75rem; color:#8a7880; margin-top:2.5rem; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="scores">
${rows}
  </div>
  <a href="/" class="cta">Jogar agora</a>
  <p class="brand">termo multiplayer</p>
</body>
</html>`
}

export function shareHandler(req: Request, res: Response): void {
  const encoded = (req.query.d as string) ?? ''
  const payload = decodePayload(encoded)
  if (!payload) {
    res.redirect('/')
    return
  }
  const shareUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(renderShareHtml(payload, shareUrl))
}
