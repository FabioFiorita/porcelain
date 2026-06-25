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

// Mock the LSP domain hook (not the tRPC proxy) so the editor renders without a
// language server or repo store. A mutable state object lets each test flip the
// feature on/off and seed diagnostics.
const lsp = vi.hoisted(() => ({
  enabled: false,
  diagnostics: [] as import('@main/lsp').Diagnostic[],
}))
vi.mock('@renderer/hooks/use-lsp', () => ({
  useLspEnabledFor: () => lsp.enabled,
  useLspDocSync: () => {},
  // mirrors the real hook's contract: [] whenever the feature is off, so the
  // editor's off-path is genuinely inert (no markers from stale diagnostics)
  useDiagnostics: (_repo: unknown, _path: unknown, enabled: boolean) =>
    enabled ? lsp.diagnostics : [],
  useLspActions: () => ({
    hover: vi.fn().mockResolvedValue(null),
    definition: vi.fn().mockResolvedValue([]),
    references: vi.fn().mockResolvedValue([]),
  }),
}))

// Import AFTER mocks are declared (Vitest hoists vi.mock to the top of the module).
import { EditorSource } from './editor-source'

beforeEach(() => {
  // pinTab (called inside edit) requires a pane to exist.
  useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
  lsp.enabled = false
  lsp.diagnostics = []
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

// --- LSP gating: the feature must be fully inert when off, and surface markers when on.

test('LSP off: no diagnostic marker renders even when diagnostics exist', () => {
  // Diagnostics present, but the feature is off → the hook returns [] and the
  // editor must render exactly as before (no gutter dot).
  lsp.enabled = false
  lsp.diagnostics = [
    { line: 0, character: 0, endLine: 0, endCharacter: 3, severity: 'error', message: 'boom' },
  ]
  render(<EditorSource path="/repo/a.ts" initialContent="let x = 1" />)
  expect(screen.queryByTestId('diagnostic-gutter-dot')).toBeNull()
})

test('LSP on: a seeded diagnostic renders a gutter marker carrying the message', () => {
  lsp.enabled = true
  lsp.diagnostics = [
    {
      line: 0,
      character: 4,
      endLine: 0,
      endCharacter: 5,
      severity: 'error',
      message: "Type 'string' is not assignable to 'number'.",
    },
  ]
  render(<EditorSource path="/repo/a.ts" initialContent="let x = 'a'" />)
  const dot = screen.getByTestId('diagnostic-gutter-dot')
  expect(dot).toBeTruthy()
  // the marker carries the diagnostic message as its hover title
  expect(dot.getAttribute('title')).toBe("Type 'string' is not assignable to 'number'.")
})
