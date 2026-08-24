import { describe, expect, it } from 'vitest'
import {
  formatKbd,
  formatKbdParts,
  isModExclusive,
  isTerminalTarget,
  isTextEntry,
} from './keyboard'

// Mount a child element inside a terminal host appended to the document body.
// This lets `closest()` traverse correctly in the jsdom environment.
function inTerminalHost(tag: string): HTMLElement {
  const host = document.createElement('div')
  host.className = 'porcelain-ghostty-terminal'
  const el = document.createElement(tag)
  host.appendChild(el)
  document.body.appendChild(host)
  return el
}

describe('isTextEntry', () => {
  it('returns true for an <input>', () => {
    const el = document.createElement('input')
    expect(isTextEntry(el)).toBe(true)
  })

  it('returns true for a <textarea>', () => {
    const el = document.createElement('textarea')
    expect(isTextEntry(el)).toBe(true)
  })

  it('returns true for a contentEditable element', () => {
    // jsdom 29 does not implement isContentEditable (returns undefined), so stub it
    // directly — this pins the code path that isTextEntry checks.
    const el = document.createElement('div')
    Object.defineProperty(el, 'isContentEditable', { value: true, configurable: true })
    expect(isTextEntry(el)).toBe(true)
  })

  it('returns false for a plain <div>', () => {
    const el = document.createElement('div')
    expect(isTextEntry(el)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isTextEntry(null)).toBe(false)
  })

  it('returns false for an <input> inside the terminal host (the spawn-shortcut carve-out)', () => {
    expect(isTextEntry(inTerminalHost('input'))).toBe(false)
  })

  it('returns false for a <textarea> inside the terminal host', () => {
    expect(isTextEntry(inTerminalHost('textarea'))).toBe(false)
  })
})

describe('isTerminalTarget', () => {
  it('returns true for an element inside the terminal host', () => {
    expect(isTerminalTarget(inTerminalHost('textarea'))).toBe(true)
  })

  it('returns true for the terminal host itself', () => {
    const host = document.createElement('div')
    host.className = 'porcelain-ghostty-terminal'
    document.body.appendChild(host)
    expect(isTerminalTarget(host)).toBe(true)
  })

  it('returns false for a plain element outside the terminal host', () => {
    const el = document.createElement('div')
    expect(isTerminalTarget(el)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isTerminalTarget(null)).toBe(false)
  })
})

// The browser client (Safari/Chrome) makes Ctrl the primary modifier; the Electron shell
// keeps Cmd. Both helpers take the mode as a param, so the pure logic is checked for both
// without stubbing the platform bridge (which forces the browser default under jsdom).
describe('isModExclusive', () => {
  describe('shell mode (Cmd is primary)', () => {
    it('is true for Cmd alone, false when Ctrl is also down', () => {
      expect(isModExclusive({ metaKey: true, ctrlKey: false }, false)).toBe(true)
      expect(isModExclusive({ metaKey: true, ctrlKey: true }, false)).toBe(false)
    })

    it('is false for Ctrl alone (the foreign modifier must not fire it)', () => {
      expect(isModExclusive({ metaKey: false, ctrlKey: true }, false)).toBe(false)
    })
  })

  describe('browser mode (Ctrl is primary)', () => {
    it('is true for Ctrl alone, false when Cmd is also down', () => {
      expect(isModExclusive({ metaKey: false, ctrlKey: true }, true)).toBe(true)
      expect(isModExclusive({ metaKey: true, ctrlKey: true }, true)).toBe(false)
    })

    it('is false for Cmd alone (the foreign modifier must not fire it)', () => {
      expect(isModExclusive({ metaKey: true, ctrlKey: false }, true)).toBe(false)
    })
  })
})

describe('formatKbd', () => {
  describe('shell mode (Cmd is primary)', () => {
    it('renders mod/alt/shift as ⌘/⌥/⇧, joined tight, other tokens verbatim', () => {
      expect(formatKbd(['mod', 'B'], false)).toBe('⌘B')
      expect(formatKbd(['mod', 'shift', 'S'], false)).toBe('⌘⇧S')
      expect(formatKbd(['alt', '↵'], false)).toBe('⌥↵')
    })
  })

  describe('browser mode (Ctrl is primary)', () => {
    it('renders mod/alt/shift as the words Ctrl/Alt/Shift, joined with +', () => {
      expect(formatKbd(['mod', 'B'], true)).toBe('Ctrl+B')
      expect(formatKbd(['mod', 'shift', 'S'], true)).toBe('Ctrl+Shift+S')
      expect(formatKbd(['alt', '↵'], true)).toBe('Alt+↵')
    })
  })

  describe('Linux shell mode (words, joined with +)', () => {
    it('renders mod/alt/shift as the words Ctrl/Alt/Shift, other tokens verbatim', () => {
      expect(formatKbd(['mod', 'B'], true, true)).toBe('Ctrl+B')
      expect(formatKbd(['mod', 'shift', 'F'], true, true)).toBe('Ctrl+Shift+F')
      expect(formatKbd(['alt', 'Backspace'], true, true)).toBe('Alt+Backspace')
    })

    it('takes precedence over the glyph style even when ctrlPrimary is set', () => {
      expect(formatKbd(['mod', 'shift', 'S'], true, true)).toBe('Ctrl+Shift+S')
    })
  })
})

describe('formatKbdParts', () => {
  it('keeps each key as its own label so the UI can render split keycaps', () => {
    expect(formatKbdParts(['mod', 'shift', 'T'], false)).toEqual(['⌘', '⇧', 'T'])
    expect(formatKbdParts(['mod', 'T'], true)).toEqual(['Ctrl', 'T'])
  })
})

describe('the terminal host asymmetry (load-bearing for destructive-shortcut safety)', () => {
  // A <textarea> inside the terminal host is the renderer's hidden input element.
  // isTextEntry → false  (so ⌘T/⌘N still spawn a terminal tab)
  // isTerminalTarget → true  (so ⌘D/⌘⌫ do NOT trash a file when terminal is focused)
  it('for a terminal textarea: isTextEntry is false and isTerminalTarget is true', () => {
    const el = inTerminalHost('textarea')
    expect(isTextEntry(el)).toBe(false)
    expect(isTerminalTarget(el)).toBe(true)
  })
})
