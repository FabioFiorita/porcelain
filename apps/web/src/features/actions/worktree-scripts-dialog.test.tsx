import type { ActionView } from '@porcelain/contracts/actions'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { setPrimaryEnvironmentId } from '@renderer/lib/environment-sessions'
import { useWorktreeScriptsStore } from '@renderer/stores/worktree-scripts'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { WorktreeScriptsDialog } from './worktree-scripts-dialog'

const install: ActionView = {
  id: 'script-install',
  title: 'Install deps',
  command: 'pnpm install',
  kind: 'worktree-setup',
  order: 1,
  createdAt: 1,
  trusted: true,
}

const teardown: ActionView = {
  id: 'script-teardown',
  title: 'Stop containers',
  command: 'docker compose down',
  kind: 'worktree-dispose',
  order: 2,
  createdAt: 2,
  trusted: false,
}

describe('WorktreeScriptsDialog', () => {
  beforeEach(() => {
    setPrimaryEnvironmentId('env-local')
    useWorktreeScriptsStore.setState({ target: null })
  })

  it('is closed until a Project row opens it', () => {
    render(<WorktreeScriptsDialog />)
    expect(screen.queryByTestId(TestIds.hubWorktreeScriptsDialog)).toBeNull()
  })

  it('lets the human add On create and On remove scripts for that Project', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
      actions: () => ({ ok: true, value: [install, teardown] }),
    })
    useWorktreeScriptsStore.getState().open({
      projectId: 'proj-alpha',
      projectName: 'alpha',
      environmentId: 'env-local',
      editable: true,
    })
    render(<WorktreeScriptsDialog />, { wrapper })

    const dialog = await screen.findByTestId(TestIds.hubWorktreeScriptsDialog)
    expect(dialog).toHaveTextContent('Worktree scripts')
    expect(dialog).toHaveTextContent('alpha')

    const setup = screen.getByTestId(TestIds.actionsScripts('worktree-setup'))
    const dispose = screen.getByTestId(TestIds.actionsScripts('worktree-dispose'))
    expect(setup).toHaveTextContent('On create')
    expect(dispose).toHaveTextContent('On remove')
    await waitFor(() => {
      expect(setup).toHaveTextContent('pnpm install')
      expect(dispose).toHaveTextContent('docker compose down')
    })

    fireEvent.click(screen.getByTestId(TestIds.actionsScriptAdd('worktree-setup')))
    expect(screen.getByRole('dialog', { name: 'New setup script' })).toBeInTheDocument()
  })

  it('hides the add buttons when the Project is read-only', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
      actions: () => ({ ok: true, value: [install] }),
    })
    useWorktreeScriptsStore.getState().open({
      projectId: 'proj-alpha',
      projectName: 'alpha',
      environmentId: 'env-remote',
      editable: false,
    })
    render(<WorktreeScriptsDialog />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId(TestIds.actionsScripts('worktree-setup'))).toBeInTheDocument()
    })
    expect(screen.queryByTestId(TestIds.actionsScriptAdd('worktree-setup'))).toBeNull()
    expect(screen.queryByTestId(TestIds.actionsScriptAdd('worktree-dispose'))).toBeNull()
  })
})
