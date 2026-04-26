export interface SharePayload {
  w: string | null
  s: { n: string; r: number }[]
  t: number
}

export function encodePayload(payload: SharePayload): string {
  return btoa(encodeURIComponent(JSON.stringify(payload)))
}

export function decodePayload(encoded: string): SharePayload | null {
  if (!encoded) return null
  try {
    const json = decodeURIComponent(atob(encoded))
    const p = JSON.parse(json)
    if (typeof p !== 'object' || p === null) return null
    if (!('w' in p) || !Array.isArray(p.s) || typeof p.t !== 'number') return null
    return p as SharePayload
  } catch {
    return null
  }
}

export function buildShareText(payload: SharePayload, url: string): string {
  const lines: string[] = []

  if (payload.w !== null) {
    lines.push(`🏆 ${payload.w} venceu o Termo!`)
  } else {
    lines.push('🤝 Empate no Termo!')
  }

  lines.push('')

  payload.s.forEach((entry, i) => {
    const medal = payload.w === null ? '🥇' : i === 0 ? '🥇' : `${i + 1}º`
    lines.push(`${medal} ${entry.n} — ${entry.r}/${payload.t} rodadas`)
  })

  lines.push('')
  lines.push(`Jogue agora: ${url}`)

  return lines.join('\n')
}

export function buildShareUrl(payload: SharePayload, baseUrl: string): string {
  const encoded = encodePayload(payload)
  return `${baseUrl}/share?d=${encoded}`
}
