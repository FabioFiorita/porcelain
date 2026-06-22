import { usePluginInfo } from '@renderer/hooks/use-plugin'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { render } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginUpdateToast } from './plugin-update-toast'

// Mock the domain hook (never tRPC) and the toast system; the component is pure
// side effect, so we assert on what it tells sonner.
vi.mock('@renderer/hooks/use-plugin', () => ({ usePluginInfo: vi.fn() }))
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }))

// Narrow view of sonner's action option (a loose ReactNode | Action union) — we
// only invoke the click, whose event arg the handler ignores.
interface ToastAction {
  label: React.ReactNode
  onClick: () => void
}

const pluginInfo = (version: string): ReturnType<typeof usePluginInfo> => ({
  version,
  marketplaceDir: '/tmp/plugin',
  commands: [],
})

const lastToast = (): NonNullable<Parameters<typeof toast.info>[1]> => {
  const opts = vi.mocked(toast.info).mock.calls[0]?.[1]
  if (!opts) throw new Error('expected a toast to have been raised')
  return opts
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(usePluginInfo).mockReturnValue(pluginInfo('2.4.0'))
  usePreferencesStore.setState({
    pluginInstalled: true,
    pluginVersion: '2.3.0',
    pluginUpdateDismissedVersion: null,
  })
  useSettingsDialogStore.setState({ open: false, section: 'general' })
})

describe('PluginUpdateToast', () => {
  it('raises a toast when the bundled plugin is newer than the installed one', () => {
    render(<PluginUpdateToast />)
    expect(toast.info).toHaveBeenCalledTimes(1)
    const [title, opts] = vi.mocked(toast.info).mock.calls[0]
    expect(title).toBe('Plugin update available')
    expect(opts?.description).toContain('v2.3.0')
    expect(opts?.description).toContain('v2.4.0')
  })

  it('stays silent when the versions match', () => {
    usePreferencesStore.setState({ pluginVersion: '2.4.0' })
    render(<PluginUpdateToast />)
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('stays silent when the plugin was never installed', () => {
    usePreferencesStore.setState({ pluginInstalled: false })
    render(<PluginUpdateToast />)
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('stays silent once the user dismissed this version', () => {
    usePreferencesStore.setState({ pluginUpdateDismissedVersion: '2.4.0' })
    render(<PluginUpdateToast />)
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('opens Settings to Agents and records the dismissal from the action', () => {
    render(<PluginUpdateToast />)
    const action = lastToast().action as ToastAction
    action.onClick()
    expect(useSettingsDialogStore.getState().open).toBe(true)
    expect(useSettingsDialogStore.getState().section).toBe('agents')
    expect(usePreferencesStore.getState().pluginUpdateDismissedVersion).toBe('2.4.0')
  })

  it('records the dismissal when the toast is closed', () => {
    render(<PluginUpdateToast />)
    const onDismiss = lastToast().onDismiss
    onDismiss?.({ id: 'plugin-update' } as Parameters<NonNullable<typeof onDismiss>>[0])
    expect(usePreferencesStore.getState().pluginUpdateDismissedVersion).toBe('2.4.0')
  })
})
