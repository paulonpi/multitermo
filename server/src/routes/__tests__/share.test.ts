import { describe, it, expect } from 'vitest'
import { decodePayload, buildOgTitle, buildOgDescription, renderShareHtml } from '../share'
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

function encode(p: SharePayload): string {
  return Buffer.from(encodeURIComponent(JSON.stringify(p))).toString('base64')
}

describe('decodePayload', () => {
  it('decodes a valid payload', () => {
    expect(decodePayload(encode(payload))).toEqual(payload)
  })

  it('decodes a draw payload', () => {
    expect(decodePayload(encode(drawPayload))).toEqual(drawPayload)
  })

  it('handles accented names', () => {
    const p: SharePayload = { w: 'José', s: [{ n: 'José', r: 3 }, { n: 'Inês', r: 2 }], t: 5 }
    expect(decodePayload(encode(p))).toEqual(p)
  })

  it('returns null for empty string', () => {
    expect(decodePayload('')).toBeNull()
  })

  it('returns null for invalid base64', () => {
    expect(decodePayload('!!!')).toBeNull()
  })

  it('returns null for missing required fields', () => {
    const bad = Buffer.from(encodeURIComponent(JSON.stringify({ w: 'X' }))).toString('base64')
    expect(decodePayload(bad)).toBeNull()
  })
})

describe('buildOgTitle', () => {
  it('includes winner name when there is a winner', () => {
    expect(buildOgTitle(payload)).toContain('Paulo')
  })

  it('mentions draw when winnerName is null', () => {
    expect(buildOgTitle(drawPayload).toLowerCase()).toMatch(/empate/)
  })
})

describe('buildOgDescription', () => {
  it('lists player scores', () => {
    const desc = buildOgDescription(payload)
    expect(desc).toContain('Paulo')
    expect(desc).toContain('Ana')
    expect(desc).toContain('3')
    expect(desc).toContain('2')
    expect(desc).toContain('5')
  })

  it('works for draw', () => {
    const desc = buildOgDescription(drawPayload)
    expect(desc).toContain('Paulo')
    expect(desc).toContain('Ana')
  })
})

describe('renderShareHtml', () => {
  it('returns a complete html document', () => {
    const html = renderShareHtml(payload, 'https://example.com/share?d=abc')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('</html>')
  })

  it('includes og:title meta tag', () => {
    const html = renderShareHtml(payload, 'https://example.com/share?d=abc')
    expect(html).toContain('og:title')
    expect(html).toContain('Paulo')
  })

  it('includes og:description meta tag', () => {
    const html = renderShareHtml(payload, 'https://example.com/share?d=abc')
    expect(html).toContain('og:description')
  })

  it('includes og:url with the share url', () => {
    const url = 'https://example.com/share?d=abc'
    const html = renderShareHtml(payload, url)
    expect(html).toContain('og:url')
    expect(html).toContain(url)
  })

  it('includes a link back to the home page', () => {
    const html = renderShareHtml(payload, 'https://example.com/share?d=abc')
    expect(html).toMatch(/href="\/?"/)
  })

  it('escapes html special characters in names', () => {
    const p: SharePayload = { w: '<script>', s: [{ n: '<script>', r: 3 }], t: 5 }
    const html = renderShareHtml(p, 'https://example.com/share?d=abc')
    expect(html).not.toContain('<script>')
  })
})
