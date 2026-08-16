import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { terminalContractFixtures } from '@porcelain/contracts/terminal'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { setPrimaryEnvironmentId } from '@renderer/lib/environment-sessions'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DevServersSection } from './dev-servers-section'

const TARGET = terminalContractFixtures.startDevServer.input.target
const RUNNING = terminalContractFixtures.devServers.output[0]
const EXITED = terminalContractFixtures.devServers.output[1]

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

function selectWorktree(): void {
  useHubSelectionStore.getState().selectWorktree({
    environmentId: 'environment-1',
    projectId: TARGET.projectId,
    worktreeId: TARGET.worktreeId,
    path: TARGET.path,
    name: 'repo',
  })
}

beforeEach(() => {
  setPrimaryEnvironmentId('environment-1')
  useHubSelectionStore.setState({ selection: { kind: 'home' } })
  useTerminalsStore.getState().reset()
})

describe('the Servers section', () => {
  it('lists the daemon-owned servers for the selected Worktree', async () => {
    selectWorktree()
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      devServers: (input) => {
        expect(input).toEqual({ target: TARGET })
        return { ok: true, value: [RUNNING, EXITED] }
      },
    })

    render(<DevServersSection />, { wrapper })

    await waitFor(() =>
      expect(screen.getByTestId(TestIds.devServerRow(RUNNING.id))).toHaveAttribute(
        'data-status',
        'running',
      ),
    )
    expect(screen.getByTestId(TestIds.devServerRow(EXITED.id))).toHaveAttribute(
      'data-status',
      'exited',
    )
    expect(screen.getByText(RUNNING.command)).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.devServerUrl(RUNNING.id))).toHaveTextContent(
      RUNNING.detectedUrl,
    )
  })

  it('renders nothing at all without a selected Worktree — there is no target to start into', () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      devServers: () => ({ ok: true, value: [] }),
    })

    const { container } = render(<DevServersSection />, { wrapper })

    expect(container).toBeEmptyDOMElement()
    expect(mock.requests().filter((request) => request.procedure === 'devServers')).toEqual([])
  })

  it('sends the current Hub target with a start, and refuses to submit an empty command', async () => {
    selectWorktree()
    const started = vi.fn()
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      devServers: () => ({ ok: true, value: [] }),
      startDevServer: (input) => {
        started(input)
        return { ok: true, value: RUNNING }
      },
    })

    render(<DevServersSection />, { wrapper })
    await waitFor(() => expect(screen.getByTestId(TestIds.devServerSubmit)).toBeInTheDocument())

    expect(screen.getByTestId(TestIds.devServerSubmit)).toBeDisabled()
    fireEvent.change(screen.getByTestId(TestIds.devServerLabelInput), {
      target: { value: 'web' },
    })
    expect(screen.getByTestId(TestIds.devServerSubmit)).toBeDisabled()

    fireEvent.change(screen.getByTestId(TestIds.devServerCommandInput), {
      target: { value: '  pnpm dev  ' },
    })
    fireEvent.click(screen.getByTestId(TestIds.devServerSubmit))

    await waitFor(() =>
      expect(started).toHaveBeenCalledWith({
        target: TARGET,
        label: 'web',
        command: 'pnpm dev',
      }),
    )
  })

  it('stops a live server and dismisses a finished one, each by its own id', async () => {
    selectWorktree()
    const stopped = vi.fn()
    const dismissed = vi.fn()
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      devServers: () => ({ ok: true, value: [RUNNING, EXITED] }),
      stopDevServer: (input) => {
        stopped(input)
        return { ok: true, value: { ...RUNNING, status: 'stopped' as const, endedAt: 9 } }
      },
      dismissDevServer: (input) => {
        dismissed(input)
        return { ok: true, value: undefined }
      },
    })

    render(<DevServersSection />, { wrapper })
    await waitFor(() =>
      expect(screen.getByTestId(TestIds.devServerStop(RUNNING.id))).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByTestId(TestIds.devServerStop(RUNNING.id)))
    await waitFor(() => expect(stopped).toHaveBeenCalledWith({ id: RUNNING.id }))

    // A finished record offers Dismiss instead of Stop: there is nothing left to stop.
    expect(screen.queryByTestId(TestIds.devServerStop(EXITED.id))).toBeNull()
    fireEvent.click(screen.getByTestId(TestIds.devServerDismiss(EXITED.id)))
    await waitFor(() => expect(dismissed).toHaveBeenCalledWith({ id: EXITED.id }))
  })

  it('opens the output of the underlying session rather than starting a second process', async () => {
    selectWorktree()
    useTerminalsStore
      .getState()
      .hydrate([{ id: RUNNING.terminalId, name: 'web', status: 'running', origin: 'primary' }])
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      devServers: () => ({ ok: true, value: [RUNNING] }),
    })

    render(<DevServersSection />, { wrapper })
    await waitFor(() =>
      expect(screen.getByTestId(TestIds.devServerAttach(RUNNING.id))).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByTestId(TestIds.devServerAttach(RUNNING.id)))

    expect(useTerminalsStore.getState().panelOpen).toBe(true)
    expect(useTerminalsStore.getState().panelSessionId).toBe(RUNNING.terminalId)
  })
})
