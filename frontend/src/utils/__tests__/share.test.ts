import { describe, it, expect } from 'vitest'
import { encodePayload, decodePayload, buildShareText, buildShareUrl } from '../share'
import type { SharePayload } from '../share'

const payload: SharePayload = {
  w: 'Paulo',
  s: [
    { n: 'Paulo', r: 3 },
    { n: 'Ana', r: 2 },
  ],
  t: 5,
}

const drawPayload: SharePayload = {
  w: null,
  s: [
    { n: 'Paulo', r: 2 },
    { n: 'Ana', r: 2 },
  ],
  t: 5,
}

describe('encodePayload / decodePayload', () => {
  it('round-trips a normal payload', () => {
    const encoded = encodePayload(payload)
    expect(typeof encoded).toBe('string')
    expect(decodePayload(encoded)).toEqual(payload)
  })

  it('round-trips a draw payload', () => {
    const encoded = encodePayload(drawPayload)
    expect(decodePayload(encoded)).toEqual(drawPayload)
  })

  it('handles names with accented characters', () => {
    const p: SharePayload = { w: 'José', s: [{ n: 'José', r: 3 }, { n: 'Inês', r: 2 }], t: 5 }
    expect(decodePayload(encodePayload(p))).toEqual(p)
  })

  it('returns null for empty string', () => {
    expect(decodePayload('')).toBeNull()
  })

  it('returns null for invalid base64', () => {
    expect(decodePayload('!!not-base64!!')).toBeNull()
  })

  it('returns null for valid base64 but non-JSON', () => {
    expect(decodePayload(btoa('not json'))).toBeNull()
  })

  it('returns null when required fields are missing', () => {
    expect(decodePayload(btoa(JSON.stringify({ w: 'X' })))).toBeNull()
  })
})

describe('buildShareText', () => {
  it('formats winner result correctly', () => {
    const url = 'https://example.com/share?d=abc'
    const text = buildShareText(payload, url)
    expect(text).toContain('Paulo')
    expect(text).toContain('3/5')
    expect(text).toContain('2/5')
    expect(text).toContain(url)
    expect(text).toContain('🏆')
  })

  it('formats draw result correctly', () => {
    const url = 'https://example.com/share?d=abc'
    const text = buildShareText(drawPayload, url)
    expect(text).toContain('🤝')
    expect(text).toContain('2/5')
    expect(text).toContain(url)
  })

  it('includes all player names', () => {
    const url = 'https://example.com/share?d=abc'
    const text = buildShareText(payload, url)
    expect(text).toContain('Paulo')
    expect(text).toContain('Ana')
  })
})

describe('buildShareUrl', () => {
  it('builds a url with the encoded payload as ?d= param', () => {
    const base = 'https://example.com'
    const url = buildShareUrl(payload, base)
    expect(url.startsWith(`${base}/share?d=`)).toBe(true)
    const encoded = new URL(url).searchParams.get('d')!
    expect(decodePayload(encoded)).toEqual(payload)
  })
})
