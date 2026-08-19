import { fileViewFixtures } from '@porcelain/contracts/files'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTabsStore } from '@renderer/stores/tabs'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { FileContent } from './file-content'

const refreshTree = vi.fn()
const useFileContent = vi.fn()

vi.mock(import('@renderer/features/files'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useFileContent: () => useFileContent(),
    useRefreshFilesTree: () => refreshTree,
    useWriteTextFile: () => ({ save: async () => {}, isSaving: false, error: null }),
    useFilePreview: () => ({ html: null, error: null }),
    useFilePreviewSrc: () => null,
  }
})

vi.mock('@renderer/hooks/use-reveal-in-finder', () => ({
  useRevealInFinder: () => () => {},
  useCanRevealInFinder: () => false,
}))

vi.mock('@renderer/features/review', () => ({
  useCommentActions: () => ({ add: async () => {} }),
  useCommentIndex: () => ({ byLine: new Map(), fileLevel: [] }),
}))

beforeEach(() => {
  refreshTree.mockClear()
  useFileContent.mockReset()
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

test('binary FileView shows size in KB and does not throw', () => {
  useFileContent.mockReturnValue({ view: fileViewFixtures.binary, error: null })
  render(<FileContent path="/repo/a.bin" paneIndex={0} />)
  expect(screen.getByText(/Binary file/)).toBeTruthy()
  expect(screen.getByText(/0.0 KB/)).toBeTruthy()
})

test('too-large FileView shows size in MB and does not throw', () => {
  useFileContent.mockReturnValue({ view: fileViewFixtures.tooLarge, error: null })
  render(<FileContent path="/repo/a.bin" paneIndex={0} />)
  expect(screen.getByText(/too large to preview/i)).toBeTruthy()
  expect(screen.getByText(/10.0 MB/)).toBeTruthy()
})

test('not-found FileView shows missing-file copy and refreshes the tree', () => {
  useFileContent.mockReturnValue({ view: fileViewFixtures.notFound, error: null })
  render(<FileContent path="/repo/a.bin" paneIndex={0} />)
  expect(screen.getByText('This file no longer exists.')).toBeTruthy()
  expect(refreshTree).toHaveBeenCalled()
})

test('text FileView mounts the editable TextFileView', () => {
  useFileContent.mockReturnValue({ view: fileViewFixtures.text, error: null })
  render(<FileContent path="/repo/a.ts" paneIndex={0} />)
  expect(screen.getByLabelText('Edit /repo/a.ts')).toBeTruthy()
})
