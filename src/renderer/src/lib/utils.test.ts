import { describe, expect, it } from 'vitest'
import { cn } from './utils'

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
