import type { VersionSkew } from '@renderer/lib/version-skew'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { render } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DaemonSkewToast } from './daemon-skew-toast'

// Mock the domain hook (never tRPC) and the toast system; the component is a pure
// side effect, so we assert on what it tells sonner.
vi.mock('@renderer/hooks/use-daemon-skew', () => ({ useDaemonSkew: vi.fn() }))
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))

import { useDaemonSkew } from '@renderer/hooks/use-daemon-skew'

interface ToastAction {
  label: React.ReactNode
  onClick: () => void
}

const skew = (over: Partial<VersionSkew> = {}): VersionSkew => ({
  daemonVersion: '0.28.2',
  appVersion: '0.29.2',
  daemonIsOlder: true,
  message: 'Daemon v0.28.2 · app v0.29.2 — restart the remote daemon to update',
  ...over,
})

const lastToast = (): NonNullable<Parameters<typeof toast.warning>[1]> => {
  const opts = vi.mocked(toast.warning).mock.calls.at(-1)?.[1]
  if (!opts) throw new Error('expected a toast to have been raised')
  return opts
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useDaemonSkew).mockReturnValue(null)
  useSettingsDialogStore.setState({ open: false, section: 'general' })
})

describe('DaemonSkewToast', () => {
  it('stays silent when there is no skew', () => {
    render(<DaemonSkewToast />)
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('raises one toast carrying the skew message', () => {
    vi.mocked(useDaemonSkew).mockReturnValue(skew())
    render(<DaemonSkewToast />)
    expect(toast.warning).toHaveBeenCalledTimes(1)
    const [title, opts] = vi.mocked(toast.warning).mock.calls[0]
    expect(title).toBe('Daemon version mismatch')
    expect(opts?.description).toBe(
      'Daemon v0.28.2 · app v0.29.2 — restart the remote daemon to update',
    )
  })

  it('does not re-toast on a re-render that returns the same daemon version', () => {
    vi.mocked(useDaemonSkew).mockReturnValue(skew())
    const { rerender } = render(<DaemonSkewToast />)
    rerender(<DaemonSkewToast />)
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })

  it('re-toasts when the daemon version changes (a reconnect to a different daemon)', () => {
    vi.mocked(useDaemonSkew).mockReturnValue(skew())
    const { rerender } = render(<DaemonSkewToast />)
    vi.mocked(useDaemonSkew).mockReturnValue(skew({ daemonVersion: '0.27.0' }))
    rerender(<DaemonSkewToast />)
    expect(toast.warning).toHaveBeenCalledTimes(2)
  })

  it('opens Settings → Environments from the toast action', () => {
    vi.mocked(useDaemonSkew).mockReturnValue(skew())
    render(<DaemonSkewToast />)
    const action = lastToast().action as ToastAction
    action.onClick()
    const state = useSettingsDialogStore.getState()
    expect(state.open).toBe(true)
    expect(state.section).toBe('environments')
  })
})
