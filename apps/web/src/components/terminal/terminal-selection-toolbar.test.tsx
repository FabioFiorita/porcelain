import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TerminalSelectionToolbar } from './terminal-selection-toolbar'

const anchor = vi.fn()
const subscribe = vi.fn()
const copySelection = vi.fn().mockResolvedValue(undefined)

vi.mock('@renderer/lib/terminal-registry', () => ({
  getTerminalSelectionAnchor: (): ReturnType<typeof anchor> => anchor(),
  subscribeTerminalSelection: (_id: string, cb: () => void): (() => void) | null =>
    subscribe(_id, cb),
  copyTerminalSelection: (...args: unknown[]) => copySelection(...args),
}))

describe('TerminalSelectionToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    anchor.mockReturnValue(null)
    // Instance is ready — subscribe immediately and fire the initial callback path via refresh.
    subscribe.mockImplementation((_id: string, cb: () => void) => {
      cb()
      return (): void => {}
    })
  })

  it('renders nothing without a selection', () => {
    const { container } = render(<TerminalSelectionToolbar sessionId="s1" />)
    expect(
      container.querySelector(`[data-testid="${TestIds.terminalSelectionToolbar}"]`),
    ).toBeNull()
  })

  it('shows Copy when there is a selection and copies on click', async () => {
    anchor.mockReturnValue({ left: 12, top: 24, text: 'selected line' })
    render(<TerminalSelectionToolbar sessionId="s1" />)

    const copy = await screen.findByTestId(TestIds.terminalSelectionCopy)
    expect(copy).toHaveTextContent('Copy')

    // mousedown must be prevented so xterm won't clear selection first.
    const down = fireEvent.mouseDown(copy)
    expect(down).toBe(false)

    fireEvent.click(copy)
    await waitFor(() => {
      expect(copySelection).toHaveBeenCalledWith('s1')
    })
  })

  it('retries subscribe until the terminal instance exists', async () => {
    let calls = 0
    const listeners: Array<() => void> = []
    subscribe.mockImplementation((_id: string, cb: () => void) => {
      calls += 1
      if (calls === 1) return null
      listeners.push(cb)
      return (): void => {}
    })
    anchor.mockReturnValue({ left: 0, top: 0, text: 'late' })

    render(<TerminalSelectionToolbar sessionId="s1" />)
    expect(screen.queryByTestId(TestIds.terminalSelectionCopy)).toBeNull()

    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(2))
    // Simulate a selection after attach.
    for (const cb of listeners) cb()
    expect(await screen.findByTestId(TestIds.terminalSelectionCopy)).toBeTruthy()
  })
})
