import { useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

// Mock the write hook so tests run without IPC or real autosave.
vi.mock('@renderer/hooks/use-files', () => ({
  useWriteTextFile: () => ({ save: vi.fn(), isSaving: false, error: null }),
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
  // pinTab (called inside edit) requires a pane to exist.
  useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
})

const ta = (): HTMLTextAreaElement =>
  screen.getByLabelText('Edit /repo/a.ts') as HTMLTextAreaElement

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
