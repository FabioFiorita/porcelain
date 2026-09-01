import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginSection } from './plugin-section'

const { mutate, toastSuccess, toastUserActionError } = vi.hoisted(() => ({
  mutate: vi.fn(),
  toastSuccess: vi.fn(),
  toastUserActionError: vi.fn(),
}))
const installState = {
  isPending: false,
  isSuccess: false,
  mutate,
}

vi.mock('@renderer/hooks/use-plugin', () => ({
  usePluginInfo: () => ({
    version: '1.6.20',
    agentPluginRepository: 'FabioFiorita/porcelain',
    claudePluginCommands: ['/plugin install porcelain@porcelain'],
  }),
}))

vi.mock('@renderer/lib/trpc', () => ({
  shellTrpc: {
    installCodexPlugin: {
      useMutation: () => installState,
    },
  },
}))

vi.mock('@renderer/hooks/mutation-error', () => ({ toastUserActionError }))
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }))

describe('PluginSection', () => {
  beforeEach(() => {
    mutate.mockReset()
    toastSuccess.mockReset()
    toastUserActionError.mockReset()
    installState.isPending = false
    installState.isSuccess = false
  })

  it('routes an explicit click through the shell installer and reports its outcome', () => {
    render(<PluginSection />)

    fireEvent.click(screen.getByRole('button', { name: 'Add to Codex' }))
    expect(mutate).toHaveBeenCalledTimes(1)

    const options = mutate.mock.calls[0]?.[1] as {
      onSuccess: () => void
      onError: (error: Error) => void
    }
    options.onSuccess()
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
})
