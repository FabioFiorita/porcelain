import { describe, expect, it } from 'vitest'
import { formatHunkHeader } from './hunk-header'

describe('formatHunkHeader', () => {
  it('turns a one-line rewrite into Line N', () => {
    expect(formatHunkHeader('@@ -1 +1 @@')).toBe('Line 1')
  })

  it('keeps a same-side range as Lines N–M', () => {
    expect(formatHunkHeader('@@ -10,5 +10,5 @@')).toBe('Lines 10–14')
  })

  it('names an add or a delete', () => {
    expect(formatHunkHeader('@@ -0,0 +1,3 @@')).toBe('Lines 1–3 added')
    expect(formatHunkHeader('@@ -4,2 +0,0 @@')).toBe('Lines 4–5 removed')
  })

  it('leads with git function context when present', () => {
    expect(formatHunkHeader('@@ -10,5 +12,7 @@ export function foo')).toBe(
      'export function foo · lines 10–14 → lines 12–18',
    )
  })

  it('leaves an unparseable header alone', () => {
    expect(formatHunkHeader('not a hunk')).toBe('not a hunk')
  })
})
