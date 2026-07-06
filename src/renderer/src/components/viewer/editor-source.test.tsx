import { useTabsStore } from '@renderer/stores/tabs'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// Capture the save call at module scope so the failed-save tests can inspect its
// arguments and choose whether to invoke the onSaved (success) callback.
const save = vi.fn()

// Mock the write hook so tests run without IPC or real autosave.
vi.mock('@renderer/hooks/use-files', () => ({
  useWriteTextFile: () => ({ save, isSaving: false, error: null }),
}))

// Mock path-action callbacks — none are exercised in these tests.
vi.mock('./use-path-actions', () => ({
  usePathActions: () => ({
    findReferences: vi.fn(),
    exploreFlow: vi.fn(),
    copyPath: vi.fn(),
    copyRelativePath: vi.fn(),
    reveal: vi.fn(),
  }),
}))

// Import AFTER mocks are declared (Vitest hoists vi.mock to the top of the module).
import { EditorSource } from './editor-source'

beforeEach(() => {
  save.mockClear()
  // pinTab (called inside edit) requires a pane to exist.
  useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
})

afterEach(() => {
  vi.useRealTimers()
})

const ta = (): HTMLTextAreaElement =>
  screen.getByLabelText('Edit /repo/a.ts') as HTMLTextAreaElement

// The autosave debounce (AUTOSAVE_DELAY_MS = 800) plus a margin.
const AUTOSAVE_DELAY_MS = 800

test('clean adoption still works (regression guard): external rewrite on a clean buffer', () => {
  const { rerender } = render(<EditorSource path="/repo/a.ts" initialContent="V1" />)
  expect(ta().value).toBe('V1')
  rerender(<EditorSource path="/repo/a.ts" initialContent="V2" />)
  expect(ta().value).toBe('V2')
})

test('mid-edit is not clobbered: external rewrite while buffer is dirty is skipped', () => {
  const { rerender } = render(<EditorSource path="/repo/a.ts" initialContent="V1" />)
  fireEvent.change(ta(), { target: { value: 'USER' } })
  rerender(<EditorSource path="/repo/a.ts" initialContent="V2" />)
  expect(ta().value).toBe('USER')
})

test('deferred adoption after returning to clean: fix — external rewrite is adopted once buffer is clean again', () => {
  const { rerender } = render(<EditorSource path="/repo/a.ts" initialContent="V1" />)
  // Make the buffer dirty so the external rewrite is skipped.
  fireEvent.change(ta(), { target: { value: 'USER' } })
  rerender(<EditorSource path="/repo/a.ts" initialContent="V2" />)
  expect(ta().value).toBe('USER') // not clobbered
  // Revert edits back to the last-saved value ("V1") — buffer is now clean again.
  fireEvent.change(ta(), { target: { value: 'V1' } })
  // The pending external rewrite (V2) should now be adopted.
  expect(ta().value).toBe('V2')
})

test('failed save keeps the buffer dirty', () => {
  vi.useFakeTimers()
  render(<EditorSource path="/repo/a.ts" initialContent="V1" />)
  fireEvent.change(ta(), { target: { value: 'USER' } })
  // Fire the debounce → the save request goes out…
  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
  })
  expect(save).toHaveBeenCalledWith('USER', expect.any(Function))
  // …but it fails: we never invoke the onSaved callback, so the watermark never
  // advances and the buffer must remain dirty.
  expect(screen.getByText('Unsaved')).toBeInTheDocument()
})

test('failed save blocks external adopt', () => {
  vi.useFakeTimers()
  const { rerender } = render(<EditorSource path="/repo/a.ts" initialContent="V1" />)
  fireEvent.change(ta(), { target: { value: 'USER' } })
  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
  })
  // Save failed (onSaved not invoked). An external rewrite must NOT clobber the
  // user's still-unsaved text.
  rerender(<EditorSource path="/repo/a.ts" initialContent="V2" />)
  expect(ta().value).toBe('USER')
})

test('successful save marks clean and allows adopt', () => {
  vi.useFakeTimers()
  const { rerender } = render(<EditorSource path="/repo/a.ts" initialContent="V1" />)
  fireEvent.change(ta(), { target: { value: 'USER' } })
  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
  })
  // Simulate the write settling successfully by invoking the captured onSaved.
  act(() => {
    save.mock.calls[0][1]()
  })
  expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()
  // Now that the buffer is clean, an external rewrite is adopted.
  rerender(<EditorSource path="/repo/a.ts" initialContent="V2" />)
  expect(ta().value).toBe('V2')
})

test('typing during an in-flight save stays dirty after it lands', () => {
  vi.useFakeTimers()
  render(<EditorSource path="/repo/a.ts" initialContent="V1" />)
  fireEvent.change(ta(), { target: { value: 'a' } })
  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
  })
  expect(save).toHaveBeenCalledWith('a', expect.any(Function))
  // User keeps typing before the "a" save settles.
  fireEvent.change(ta(), { target: { value: 'ab' } })
  // The "a" save lands: watermark advances to the snapshot ("a"), not to "ab".
  act(() => {
    save.mock.calls[0][1]()
  })
  // "ab" !== saved "a" → still dirty.
  expect(screen.getByText('Unsaved')).toBeInTheDocument()
})
