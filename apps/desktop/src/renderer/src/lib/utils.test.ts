import { describe, expect, it, vi } from 'vitest'
import { cn, randomId } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('resolves tailwind conflicts with the last class winning', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('ignores falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  // The custom sub-xs font-size tokens (main.css @theme) share the `text-` prefix
  // with color utilities. tailwind-merge must treat them as font sizes — not colors
  // — or it drops them when merged alongside a text-color, which once silently broke
  // the viewer tab labels (they fell back to the unset-root 16px). Pin that here.
  it('keeps a custom font-size token alongside a text color', () => {
    const out = cn('text-sm-minus', 'text-foreground')
    expect(out).toContain('text-sm-minus')
    expect(out).toContain('text-foreground')
  })

  it('keeps every custom font-size token when merged with a color', () => {
    const tokens = [
      'text-4xs',
      'text-3xs',
      'text-2xs',
      'text-2xs-plus',
      'text-xs-minus',
      'text-xs-plus',
      'text-sm-minus',
    ]
    for (const token of tokens) {
      expect(cn(token, 'text-muted-foreground')).toContain(token)
    }
  })

  it('still resolves two conflicting font sizes to the last one', () => {
    expect(cn('text-sm-minus', 'text-sm')).toBe('text-sm')
  })
})

describe('randomId', () => {
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  // Simulate an insecure context (tailnet browser client): randomUUID absent,
  // only getRandomValues available.
  const insecureCrypto = {
    getRandomValues: crypto.getRandomValues.bind(crypto),
  } as Crypto

  it('builds a v4-shaped UUID from getRandomValues when randomUUID is absent', () => {
    expect(randomId(insecureCrypto)).toMatch(V4)
  })

  it('produces unique ids across 100 calls in the fallback path', () => {
    const ids = new Set(Array.from({ length: 100 }, () => randomId(insecureCrypto)))
    expect(ids.size).toBe(100)
  })

  it('delegates to randomUUID when present', () => {
    const sentinel = '11111111-1111-4111-8111-111111111111'
    const spy = vi.fn<Crypto['randomUUID']>(() => sentinel)
    const secureCrypto: Crypto = { ...insecureCrypto, randomUUID: spy }
    expect(randomId(secureCrypto)).toBe(sentinel)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
