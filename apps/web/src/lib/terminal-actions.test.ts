import { useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { beforeEach, describe, expect, it } from 'vitest'
import { followTerminal, nextTerminalNumber, revealTerminal } from './terminal-actions'

describe('nextTerminalNumber', () => {
  it('starts at 1 with an empty roster', () => {
    expect(nextTerminalNumber([], 0)).toBe(1)
  })

  it('goes one past the highest existing "Terminal N"', () => {
    expect(nextTerminalNumber(['Terminal 1', 'Terminal 2'], 0)).toBe(3)
  })

  it('does not reuse a closed terminal’s number while a higher one lives', () => {
    // Terminal 1 was closed; naive row-counting would mint a duplicate "Terminal 2".
    expect(nextTerminalNumber(['Terminal 2'], 0)).toBe(3)
  })

  it('counts renamed (non-numbered) sessions via the roster size', () => {
    expect(nextTerminalNumber(['dev server'], 0)).toBe(2)
  })

  it('never dips below the monotonic floor when the roster is transiently clobbered', () => {
    // A stale terminalSessions snapshot can hydrate the roster to [] right before a
    // spawn (stores/terminals.ts); the floor keeps issued numbers from repeating.
    expect(nextTerminalNumber([], 2)).toBe(3)
  })
})

describe('reveal', () => {
  beforeEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
  })

  it('opens the Terminals board for a shell the human asked for', () => {
    revealTerminal('t-1')

    expect(useTabsStore.getState().panes[0]?.tabs.map((tab) => tab.kind)).toEqual(['terminals'])
    expect(useTerminalsStore.getState().focusedId).toBe('t-1')
  })

  it('keeps the Viewer where it is for a shell the daemon started on its own', () => {
    followTerminal('t-2')

    // A Worktree setup script must not take the pane away from what is being read; the
    // board renders `focusedId`, so it lands on this session whenever it is next shown.
    expect(useTabsStore.getState().panes[0]?.tabs).toEqual([])
    expect(useTerminalsStore.getState().focusedId).toBe('t-2')
  })
})
