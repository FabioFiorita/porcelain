import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { TextFileView } from './text-file-view'

// EditorSource (rendered for short files) calls useWriteTextFile which reaches
// tRPC. Mock only the tRPC-backed hooks; keep the rest real via importOriginal.
vi.mock(import('@renderer/hooks/use-files'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useWriteTextFile: () => ({ save: async () => {}, isSaving: false, error: null }),
    useRevealInFinder: () => () => {},
  }
})

beforeEach(() => {
  useRepoStore.setState({ repo: { path: '/repo', name: 'repo' } as never })
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
