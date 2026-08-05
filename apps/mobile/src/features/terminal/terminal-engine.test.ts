import { Terminal } from '@xterm/headless'
import { describe, expect, it } from 'vitest'

import { readViewport } from './terminal-cells'
import { TERMINAL_PALETTES } from './terminal-theme'

/**
 * The painter against the REAL VT engine.
 *
 * `terminal-cells.test.ts` covers the mapping with hand-built cells, which is fast but proves
 * only that the code agrees with itself. This suite feeds actual escape sequences to
 * `@xterm/headless` and reads what comes out, so it also proves the two things that silently
 * break otherwise: that our structural cell and buffer types still match xterm's API after an
 * upgrade, and that a sequence a shell really emits lands where we say it does.
 *
 * It cannot cover Hermes — that is what runtime evidence on a device is for. What it does cover
 * is everything above the engine.
 */

const palette = TERMINAL_PALETTES.dark

function terminal(cols = 20, rows = 5): Terminal {
  return new Terminal({ allowProposedApi: true, cols, rows, scrollback: 100 })
}

/** xterm parses asynchronously; the callback is when the buffer actually reflects the write. */
function write(term: Terminal, data: string): Promise<void> {
  return new Promise((resolve) => {
    term.write(data, resolve)
  })
}

function textOf(term: Terminal): string[] {
  return readViewport(term, palette).rows.map((runs) => runs.map((run) => run.text).join(''))
}

describe('the painter against a live xterm', () => {
  it('reads plain output back off the grid', async () => {
    const term = terminal()
    await write(term, 'hello\r\nworld')
    expect(textOf(term).slice(0, 2)).toEqual(['hello', 'world'])
  })

  it('maps SGR colour to the theme palette', async () => {
    const term = terminal()
    await write(term, '\x1b[31mred\x1b[0m')
    const runs = readViewport(term, palette).rows[0] ?? []
    expect(runs[0]?.text).toBe('red')
    expect(runs[0]?.style.color).toBe(palette.ansi[1])
  })

  it('maps 256-colour and truecolor sequences', async () => {
    const term = terminal()
    await write(term, '\x1b[38;5;196mA\x1b[38;2;0;255;127mB\x1b[0m')
    const runs = readViewport(term, palette).rows[0] ?? []
    expect(runs[0]?.style.color).toBe('#ff0000')
    expect(runs[1]?.style.color).toBe('#00ff7f')
  })

  it('carries bold, italic and underline through as text styles', async () => {
    const term = terminal()
    await write(term, '\x1b[1mb\x1b[0m\x1b[3mi\x1b[0m\x1b[4mu\x1b[0m')
    const runs = readViewport(term, palette).rows[0] ?? []
    expect(runs[0]?.style.bold).toBe(true)
    expect(runs[1]?.style.italic).toBe(true)
    expect(runs[2]?.style.underline).toBe(true)
  })

  it('paints a background fill and keeps its width', async () => {
    const term = terminal()
    await write(term, '\x1b[44m   \x1b[0m')
    const runs = readViewport(term, palette).rows[0] ?? []
    expect(runs[0]?.text).toBe('   ')
    expect(runs[0]?.style.background).toBe(palette.ansi[4])
  })

  it('follows the cursor as output moves it', async () => {
    const term = terminal()
    await write(term, 'ab\r\ncd')
    expect(readViewport(term, palette).cursor).toEqual({ column: 2, row: 1 })
  })

  it('tracks the viewport once output scrolls past the screen', async () => {
    const term = terminal(20, 3)
    await write(term, '1\r\n2\r\n3\r\n4\r\n5')
    // The grid is 3 rows, so the first two lines have scrolled into history.
    expect(textOf(term)).toEqual(['3', '4', '5'])
  })

  it('shows scrolled-back history and hides the cursor while it is off-screen', async () => {
    const term = terminal(20, 3)
    await write(term, '1\r\n2\r\n3\r\n4\r\n5')
    term.scrollLines(-2)
    expect(textOf(term)).toEqual(['1', '2', '3'])
    expect(readViewport(term, palette).cursor).toBeNull()
  })

  it('reports the alternate buffer, which is what decides how a pan scrolls', async () => {
    const term = terminal()
    expect(term.buffer.active.type).toBe('normal')
    await write(term, '\x1b[?1049h')
    expect(term.buffer.active.type).toBe('alternate')
  })

  it('reports application-cursor mode, which is what decides the arrow bytes', async () => {
    const term = terminal()
    expect(term.modes.applicationCursorKeysMode).toBe(false)
    await write(term, '\x1b[?1h')
    expect(term.modes.applicationCursorKeysMode).toBe(true)
  })

  it('answers a device-status report, which is why replies are wired back to the PTY', async () => {
    const term = terminal()
    const replies: string[] = []
    term.onData((data) => replies.push(data))
    await write(term, '\x1b[6n')
    // A TUI that asks where the cursor is and never hears back simply hangs.
    // Built rather than written inline: a control character in a regex literal is banned.
    expect(replies.join('')).toMatch(new RegExp(`${String.fromCharCode(27)}\\[\\d+;\\d+R`))
  })

  it('wraps at exactly `cols`, which is why the pane measures its grid', async () => {
    // The whole reason the view measures a character's width: get cols wrong and every line of
    // output breaks in the wrong place. (xterm does not re-wrap already-printed lines when the
    // grid widens — the width matters at the moment output arrives, so the fit has to land
    // before the shell writes, which is what the remembered size in the registry is for.)
    const term = terminal(10, 4)
    await write(term, 'abcdefghijklm')
    expect(textOf(term).slice(0, 2)).toEqual(['abcdefghij', 'klm'])

    const wide = terminal(20, 4)
    await write(wide, 'abcdefghijklm')
    expect(textOf(wide)[0]).toBe('abcdefghijklm')
  })
})
