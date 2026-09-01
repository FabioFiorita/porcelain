import { useFilesTree } from '@renderer/features/files'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { FileTree } from './file-tree'

vi.mock('@renderer/features/files', () => ({ useFilesTree: vi.fn() }))
vi.mock('@renderer/stores/tree-dirs', () => ({
  useTreeDirsStore: (select: (state: { add: () => void; remove: () => void }) => unknown) =>
    select({ add: vi.fn(), remove: vi.fn() }),
}))

beforeEach(() => {
  vi.mocked(useFilesTree).mockReset()
})

it('distinguishes loading, read failure, and an empty directory', () => {
  vi.mocked(useFilesTree).mockReturnValue({ entries: undefined, error: null, isLoading: true })
  const view = render(<FileTree rootPath="/repo" />)
  expect(screen.getByText('Loading…')).toBeInTheDocument()

  vi.mocked(useFilesTree).mockReturnValue({
    entries: undefined,
    error: { message: 'permission denied' },
    isLoading: false,
  })
  view.rerender(<FileTree rootPath="/repo" />)
  expect(screen.getByText('Could not read files: permission denied')).toBeInTheDocument()

  vi.mocked(useFilesTree).mockReturnValue({ entries: [], error: null, isLoading: false })
  view.rerender(<FileTree rootPath="/repo" />)
  expect(screen.getByText('This folder is empty.')).toBeInTheDocument()
})
