import {
  TERMINAL_DEFAULT_HEIGHT,
  TERMINAL_MIN_HEIGHT,
  usePreferencesStore,
} from '@renderer/stores/preferences'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { TerminalResizeHandle } from './sidebar-resize-handle'

describe('TerminalResizeHandle', () => {
  beforeEach(() => {
    usePreferencesStore.setState({ terminalHeight: TERMINAL_DEFAULT_HEIGHT })
  })

  it('commits the dragged height on mouseup and clamps the floor', () => {
    const { container } = render(
      <div data-slot="terminal-panel" style={{ height: TERMINAL_DEFAULT_HEIGHT }}>
        <TerminalResizeHandle />
      </div>,
    )
    const panel = container.querySelector('[data-slot="terminal-panel"]')
    if (!(panel instanceof HTMLElement)) throw new Error('expected the terminal panel')
    panel.getBoundingClientRect = () =>
      ({
        bottom: 800,
        top: 800 - TERMINAL_DEFAULT_HEIGHT,
        left: 0,
        right: 400,
        width: 400,
        height: TERMINAL_DEFAULT_HEIGHT,
        x: 0,
        y: 800 - TERMINAL_DEFAULT_HEIGHT,
        toJSON: () => ({}),
      }) as DOMRect

    fireEvent.mouseDown(screen.getByTestId(TestIds.terminalResize))
    expect(usePreferencesStore.getState().terminalHeight).toBe(TERMINAL_DEFAULT_HEIGHT)

    fireEvent.mouseMove(window, { clientY: 400 })
    expect(panel.style.height).toBe('400px')
    expect(usePreferencesStore.getState().terminalHeight).toBe(TERMINAL_DEFAULT_HEIGHT)

    fireEvent.mouseUp(window)
    expect(usePreferencesStore.getState().terminalHeight).toBe(400)

    fireEvent.mouseDown(screen.getByTestId(TestIds.terminalResize))
    fireEvent.mouseMove(window, { clientY: 790 })
    fireEvent.mouseUp(window)
    expect(usePreferencesStore.getState().terminalHeight).toBe(TERMINAL_MIN_HEIGHT)
  })
})
