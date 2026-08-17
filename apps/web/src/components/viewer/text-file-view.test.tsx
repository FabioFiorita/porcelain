import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { EDITABLE_MAX_LINES } from './editor-source'
import { TextFileView } from './text-file-view'

// EditorSource (rendered for short files) calls useWriteTextFile which reaches
// tRPC. Mock Files feature hooks; keep path helpers real via importOriginal.
vi.mock(import('@renderer/features/files'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useWriteTextFile: () => ({ save: async () => {}, isSaving: false, error: null }),
    useFilePreview: () => ({ html: null, error: null }),
  }
})

vi.mock('@renderer/hooks/use-reveal-in-finder', () => ({
  useRevealInFinder: () => () => {},
  useCanRevealInFinder: () => false,
}))

// EditorSource also mounts CommentComposer, which reaches tRPC via useCommentActions;
// mock the domain hook so it renders without a tRPC provider (the component-test rule).
vi.mock('@renderer/features/review', () => ({
  useCommentActions: () => ({ add: async () => {} }),
  useCommentIndex: () => ({ byLine: new Map(), fileLevel: [] }),
}))

beforeEach(() => {
  useProjectSelectionStore.setState({ project: { path: '/repo', name: 'repo' } as never })
  usePreferencesStore.setState({ markdownMode: 'source' } as never)
  useTabsStore.setState({
    panes: [
      { tabs: [], activeTabId: null },
      { tabs: [], activeTabId: null },
    ],
    activePaneIndex: 1,
  } as never)
})

test('Cmd+F opens the find bar only in the active pane (pane 1 active)', () => {
  render(
    <>
      <TextFileView path="/repo/a.ts" content={'const a = 1\n'} paneIndex={0} />
      <TextFileView path="/repo/b.ts" content={'const b = 2\n'} paneIndex={1} />
    </>,
  )
  fireEvent.keyDown(window, { key: 'f', metaKey: true })
  expect(screen.getAllByLabelText('Find in file')).toHaveLength(1)
})

test('Cmd+F opens the find bar only in the active pane (pane 0 active)', () => {
  useTabsStore.setState({ activePaneIndex: 0 } as never)
  render(
    <>
      <TextFileView path="/repo/a.ts" content={'const a = 1\n'} paneIndex={0} />
      <TextFileView path="/repo/b.ts" content={'const b = 2\n'} paneIndex={1} />
    </>,
  )
  fireEvent.keyDown(window, { key: 'f', metaKey: true })
  expect(screen.getAllByLabelText('Find in file')).toHaveLength(1)
})

test('a file over EDITABLE_MAX_LINES does not mount EditorSource', () => {
  const content = Array.from({ length: EDITABLE_MAX_LINES + 1 }, () => 'x').join('\n')
  render(<TextFileView path="/repo/big.ts" content={content} paneIndex={0} />)
  expect(screen.queryByLabelText('Edit /repo/big.ts')).toBeNull()
})

test('a one-line file mounts EditorSource', () => {
  render(<TextFileView path="/repo/small.ts" content={'x'} paneIndex={0} />)
  expect(screen.getByLabelText('Edit /repo/small.ts')).toBeTruthy()
})

test('a text file fills the Viewer as one inset raised card', () => {
  render(<TextFileView path="/repo/small.ts" content={'x'} paneIndex={0} />)
  expect(screen.getByTestId('code-well').className).toContain('bg-muted/30')
  expect(screen.getByTestId('code-card').className).toContain('rounded-xl')
  expect(screen.getByTestId('code-card').className).toContain('bg-card')
  expect(screen.getByTestId('code-card').className).toContain('h-full')
})

test('offers a file-level comment control on a normal file', () => {
  render(<TextFileView path="/repo/small.ts" content={'x'} paneIndex={0} />)
  expect(screen.getByLabelText('Comment on file')).toBeInTheDocument()
})
