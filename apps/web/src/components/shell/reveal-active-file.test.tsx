import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useRevealStore } from '@renderer/stores/reveal'
import { useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { RevealActiveFile } from './reveal-active-file'

const fixture = vi.hoisted(() => ({
  target: { environmentId: 'local', projectId: 'project', worktreeId: 'main', path: '/repo' },
  scope: { hiddenPaths: ['/repo/src'], pinnedPaths: [] },
}))
vi.mock('@renderer/stores/hub-repo', () => ({ useHubRepoTarget: () => fixture.target }))
vi.mock('@renderer/features/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/features/files')>()),
  useFilesScope: () => fixture.scope,
}))

beforeEach(() => {
  useProjectSelectionStore.setState({ showHidden: false })
  useRevealStore.setState({ path: null })
  useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
})

function open(path: string, environmentId = 'local'): void {
  useTabsStore.setState({
    panes: [
      {
        activeTabId: 'file',
        tabs: [
          {
            id: 'file',
            kind: 'file',
            title: 'app.ts',
            path,
            target: { ...fixture.target, environmentId },
          },
        ],
      },
    ],
  })
}

it('reveals a hidden descendant without changing the saved hidden paths', () => {
  open('/repo/src/app.ts')
  render(<RevealActiveFile rootPath="/repo" />)
  fireEvent.click(screen.getByTestId('files-reveal-active'))
  expect(useRevealStore.getState().path).toBe('/repo/src/app.ts')
  expect(useProjectSelectionStore.getState().showHidden).toBe(true)
  expect(fixture.scope.hiddenPaths).toEqual(['/repo/src'])
})

it.each(['/elsewhere/app.ts', '/repo-other/app.ts'])(
  'rejects a file outside the root: %s',
  (path) => {
    open(path)
    render(<RevealActiveFile rootPath="/repo" />)
    expect(screen.getByTestId('files-reveal-active')).toBeDisabled()
  },
)

it('rejects an identical path belonging to another environment', () => {
  open('/repo/src/app.ts', 'remote')
  render(<RevealActiveFile rootPath="/repo" />)
  expect(screen.getByTestId('files-reveal-active')).toBeDisabled()
})
