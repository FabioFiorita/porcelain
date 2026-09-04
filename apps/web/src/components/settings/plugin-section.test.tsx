import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginSection } from './plugin-section'

const { mutate, invalidate, toastSuccess, toastUserActionError } = vi.hoisted(() => ({
  mutate: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
  toastSuccess: vi.fn(),
  toastUserActionError: vi.fn(),
}))
const installState = {
  isPending: false,
  isSuccess: false,
  mutate,
}
const pluginStatus = {
  data: { state: 'not-installed', version: null, enabled: null, error: null } as {
    state: 'installed' | 'not-installed' | 'unavailable'
    version: string | null
    enabled: boolean | null
    error: string | null
  },
  isLoading: false,
}

vi.mock('@renderer/hooks/use-plugin', () => ({
  usePluginInfo: () => ({
    version: '1.6.20',
    agentPluginRepository: 'FabioFiorita/porcelain',
    claudePluginCommands: ['/plugin install porcelain@porcelain'],
    claudePluginUpdateCommands: [
      '/plugin marketplace update porcelain',
      '/plugin update porcelain@porcelain',
      '/reload-plugins',
    ],
  }),
  useCodexPluginStatus: () => pluginStatus,
}))

vi.mock('@renderer/lib/trpc', () => ({
  shellTrpc: {
    installCodexPlugin: {
      useMutation: () => installState,
    },
    useUtils: () => ({ codexPluginStatus: { invalidate } }),
  },
}))

vi.mock('@renderer/hooks/mutation-error', () => ({ toastUserActionError }))
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }))

describe('PluginSection', () => {
  beforeEach(() => {
    mutate.mockReset()
    invalidate.mockClear()
    toastSuccess.mockReset()
    toastUserActionError.mockReset()
    installState.isPending = false
    installState.isSuccess = false
    pluginStatus.data = { state: 'not-installed', version: null, enabled: null, error: null }
    pluginStatus.isLoading = false
  })

  it('routes an explicit click through the shell installer and reports its outcome', async () => {
    render(<PluginSection />)

    fireEvent.click(screen.getByRole('button', { name: 'Add to Codex' }))
    expect(mutate).toHaveBeenCalledTimes(1)

    const options = mutate.mock.calls[0]?.[1] as {
      onSuccess: () => void
      onError: (error: Error) => void
    }
    await options.onSuccess()
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(toastSuccess).toHaveBeenCalledWith('Porcelain was added to Codex.')

    const failure = new Error('Codex CLI was not found')
    options.onError(failure)
    expect(toastUserActionError).toHaveBeenCalledWith('Add Porcelain to Codex', failure)
  })

  it('prevents a duplicate click while Codex is still installing', () => {
    installState.isPending = true
    render(<PluginSection />)

    const button = screen.getByRole('button', { name: 'Adding…' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(mutate).not.toHaveBeenCalled()
  })

  it('shows the installed version and offers an explicit reinstall', () => {
    pluginStatus.data = { state: 'installed', version: '1.6.21', enabled: true, error: null }
    render(<PluginSection />)

    expect(screen.getByText(/Installed · v1\.6\.21/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Reinstall' })).toBeEnabled()
  })

  it('keeps first-time Add success truthful after installed status refreshes', async () => {
    const view = render(<PluginSection />)

    fireEvent.click(screen.getByRole('button', { name: 'Add to Codex' }))
    const options = mutate.mock.calls[0]?.[1] as { onSuccess: () => Promise<void> }
    await options.onSuccess()

    installState.isSuccess = true
    pluginStatus.data = { state: 'installed', version: '1.6.21', enabled: true, error: null }
    view.rerender(<PluginSection />)

    expect(screen.getByText(/Installation complete\. Restart Codex/)).toBeVisible()
    expect(screen.queryByText(/Reinstalled\. Restart Codex/)).toBeNull()
  })

  it('disables installation when Codex cannot be inspected and explains why', () => {
    pluginStatus.data = {
      state: 'unavailable',
      version: null,
      enabled: null,
      error: 'Codex CLI was not found.',
    }
    render(<PluginSection />)

    expect(screen.getByText('Codex CLI was not found.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add to Codex' })).toBeDisabled()
  })

  it('keeps Claude update and reload commands distinct from first install', () => {
    render(<PluginSection />)

    expect(screen.getByText('Claude Plugin — first install')).toBeVisible()
    expect(screen.getByText('Claude Plugin — update and reload')).toBeVisible()
    expect(screen.getByText(/\/plugin marketplace update porcelain/)).toBeVisible()
    expect(screen.getByText(/\/reload-plugins/)).toBeVisible()
  })
})
