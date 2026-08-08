import { useTerminalInputStore } from '@renderer/stores/terminal-input'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TerminalKeyBar } from './terminal-key-bar'

const focused = { value: false }

vi.mock('@renderer/lib/terminal-registry', () => ({
  sendTerminalInput: vi.fn(),
  sendTerminalArrow: vi.fn(),
  pasteTerminalImage: vi.fn(),
  focusTerminal: vi.fn(),
  blurTerminal: vi.fn(),
  isTerminalFocused: (): boolean => focused.value,
}))

const {
  sendTerminalInput,
  sendTerminalArrow,
  pasteTerminalImage,
  focusTerminal,
  blurTerminal,
}: Pick<
  typeof import('@renderer/lib/terminal-registry'),
  | 'sendTerminalInput'
  | 'sendTerminalArrow'
  | 'pasteTerminalImage'
  | 'focusTerminal'
  | 'blurTerminal'
> = await import('@renderer/lib/terminal-registry')

/** A tap: pointerdown (where focus is sampled) then the click that acts on it. */
function tap(testId: string): void {
  const button = screen.getByTestId(testId)
  fireEvent.pointerDown(button)
  fireEvent.click(button)
}

describe('TerminalKeyBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    focused.value = false
    useTerminalInputStore.setState({ pendingCtrlId: null })
  })

  it('sends the control bytes for the keys a soft keyboard lacks', () => {
    render(<TerminalKeyBar sessionId="s1" />)
    tap(TestIds.terminalKey('esc'))
    expect(sendTerminalInput).toHaveBeenCalledWith('s1', '\x1b')
    tap(TestIds.terminalKey('tab'))
    expect(sendTerminalInput).toHaveBeenCalledWith('s1', '\t')
    tap(TestIds.terminalKey('ctrl-c'))
    expect(sendTerminalInput).toHaveBeenCalledWith('s1', '\x03')
  })

  it('sends arrows through the registry so DECCKM is honored, not raw bytes', () => {
    render(<TerminalKeyBar sessionId="s1" />)
    tap(TestIds.terminalKey('up'))
    expect(sendTerminalArrow).toHaveBeenCalledWith('s1', 'up')
    tap(TestIds.terminalKey('left'))
    expect(sendTerminalArrow).toHaveBeenCalledWith('s1', 'left')
  })

  it('arms sticky Ctrl for THIS session and disarms on a second tap', () => {
    render(<TerminalKeyBar sessionId="s1" />)
    tap(TestIds.terminalKey('ctrl'))
    expect(useTerminalInputStore.getState().pendingCtrlId).toBe('s1')
    expect(screen.getByTestId(TestIds.terminalKey('ctrl'))).toHaveAttribute('aria-pressed', 'true')
    tap(TestIds.terminalKey('ctrl'))
    expect(useTerminalInputStore.getState().pendingCtrlId).toBeNull()
  })

  it('restores focus after a key ONLY when the terminal had it — a dismissed keyboard stays dismissed', () => {
    render(<TerminalKeyBar sessionId="s1" />)
    focused.value = false
    tap(TestIds.terminalKey('esc'))
    expect(focusTerminal).not.toHaveBeenCalled()

    focused.value = true
    tap(TestIds.terminalKey('esc'))
    expect(focusTerminal).toHaveBeenCalledWith('s1')
  })

  it('toggles the keyboard: blurs when focused, focuses when not', () => {
    render(<TerminalKeyBar sessionId="s1" />)
    focused.value = true
    tap(TestIds.terminalKey('keyboard'))
    expect(blurTerminal).toHaveBeenCalledWith('s1')

    focused.value = false
    tap(TestIds.terminalKey('keyboard'))
    expect(focusTerminal).toHaveBeenCalledWith('s1')
  })

  it('routes touch image paste through the shared clipboard action', () => {
    render(<TerminalKeyBar sessionId="s1" />)
    tap(TestIds.terminalKey('paste-image'))
    expect(pasteTerminalImage).toHaveBeenCalledWith('s1')
  })
})
