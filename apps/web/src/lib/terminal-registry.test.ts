import { describe, expect, it, vi } from 'vitest'

const { createSurface, loadSurfaceModule, surface } = vi.hoisted(() => {
  const surface = {
    dispose: vi.fn(),
    focus: vi.fn(),
    paste: vi.fn(),
    resetAndWrite: vi.fn(),
    resizeToMount: vi.fn(),
    rows: 24,
    write: vi.fn(),
  }
  return {
    createSurface: vi.fn(),
    loadSurfaceModule: vi.fn(),
    surface,
  }
})

vi.mock('@renderer/terminal/ghostty/surface', () => {
  loadSurfaceModule()
  return { GhosttyTerminalSurface: { create: createSurface } }
})

import {
  attachTerminal,
  disposeTerminal,
  pushCappedOutput,
  receiveData,
  TERMINAL_THEMES,
} from './terminal-registry'

describe('TERMINAL_THEMES', () => {
  it('keeps the dark palette byte-identical to the previous inline literal', () => {
    expect(TERMINAL_THEMES.dark).toEqual({
      background: '#16161a',
      foreground: '#e4e4e7',
      cursor: '#e4e4e7',
      selectionBackground: '#3f3f46',
    })
  })

  it('defines a complete, readable light palette on a near-white ground', () => {
    const light = TERMINAL_THEMES.light
    expect(light.background).toBe('#ffffff')
    const keys = [
      'foreground',
      'cursor',
      'selectionBackground',
      'black',
      'red',
      'green',
      'yellow',
      'blue',
      'magenta',
      'cyan',
      'white',
      'brightBlack',
      'brightRed',
      'brightGreen',
      'brightYellow',
      'brightBlue',
      'brightMagenta',
      'brightCyan',
      'brightWhite',
    ] as const
    for (const key of keys) expect(light[key]).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('pushCappedOutput', () => {
  it('buffers freely under the cap', () => {
    const buffer: string[] = []
    let units = 0
    for (let i = 0; i < 5; i += 1) units = pushCappedOutput(buffer, units, 'x'.repeat(10), 100)
    expect(buffer).toHaveLength(5)
    expect(units).toBe(50)
  })

  it('drops oldest chunks first once the cap is exceeded', () => {
    const buffer: string[] = []
    let units = 0
    units = pushCappedOutput(buffer, units, 'a'.repeat(60), 100)
    units = pushCappedOutput(buffer, units, 'b'.repeat(60), 100)
    expect(buffer).toEqual(['b'.repeat(60)])
    expect(units).toBe(60)
    units = pushCappedOutput(buffer, units, 'c'.repeat(30), 100)
    expect(buffer).toEqual(['b'.repeat(60), 'c'.repeat(30)])
    expect(units).toBe(90)
  })

  it('always keeps the newest chunk even when it alone exceeds the cap', () => {
    const buffer: string[] = ['seed']
    const units = pushCappedOutput(buffer, 4, 'z'.repeat(2000), 100)
    expect(buffer).toEqual(['z'.repeat(2000)])
    expect(units).toBe(2000)
  })
})

describe('lazy Ghostty surface', () => {
  it('buffers stream output until a deduplicated surface is attached', async () => {
    let resolveSurface: ((value: typeof surface) => void) | undefined
    createSurface.mockImplementation(
      () =>
        new Promise<typeof surface>((resolve) => {
          resolveSurface = resolve
        }),
    )

    // The shell starts stream subscriptions before a terminal pane exists. That
    // must neither load Ghostty nor lose the first bytes.
    expect(loadSurfaceModule).not.toHaveBeenCalled()
    receiveData('lazy-terminal', 'before attach')
    expect(createSurface).not.toHaveBeenCalled()

    const first = document.createElement('div')
    const second = document.createElement('div')
    document.body.append(first, second)
    attachTerminal('lazy-terminal', first)
    attachTerminal('lazy-terminal', second)

    await vi.waitFor(() => expect(createSurface).toHaveBeenCalledTimes(1))
    receiveData('lazy-terminal', ' while creating')
    resolveSurface?.(surface)

    await vi.waitFor(() => {
      expect(surface.write).toHaveBeenCalledWith('before attach')
      expect(surface.write).toHaveBeenCalledWith(' while creating')
    })

    disposeTerminal('lazy-terminal')
  })
})
