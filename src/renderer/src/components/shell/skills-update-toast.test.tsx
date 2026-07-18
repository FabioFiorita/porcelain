import { useSkillsInfo } from '@renderer/hooks/use-skills'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { render } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SkillsUpdateToast } from './skills-update-toast'

// The toast is shell-only (skills installs don't exist in the browser client), so
// it early-returns when isBrowser — jsdom's default (no preload bridge). This
// suite tests the Electron-shell behavior, so pin isBrowser false. isE2E is a
// mutable holder so the e2e-harness test can flip it per test.
const mockPlatform = vi.hoisted(() => ({ isBrowser: false, isE2E: false }))
vi.mock('@renderer/lib/platform', () => mockPlatform)

// Mock the info hook (never tRPC) and the toast system; the component is a pure
// side effect, so we assert on what it tells sonner.
vi.mock('@renderer/hooks/use-skills', () => ({ useSkillsInfo: vi.fn() }))
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }))

interface ToastAction {
  label: React.ReactNode
  onClick: () => void
}

const skillsInfo = (version: string): ReturnType<typeof useSkillsInfo> => ({
  version,
  installCommand: 'npx skills add FabioFiorita/porcelain',
  upgradeCommand: 'npx skills upgrade',
})

const lastToast = (): NonNullable<Parameters<typeof toast.info>[1]> => {
  const opts = vi.mocked(toast.info).mock.calls[0]?.[1]
  if (!opts) throw new Error('expected a toast to have been raised')
  return opts
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  mockPlatform.isE2E = false
  vi.mocked(useSkillsInfo).mockReturnValue(skillsInfo('2.9.0'))
  usePreferencesStore.setState({
    skillsDismissedVersion: null,
  })
  useSettingsDialogStore.setState({ open: false, section: 'general' })
})

describe('SkillsUpdateToast', () => {
  it('raises a toast when a newer bundle ships', () => {
    render(<SkillsUpdateToast />)
    expect(toast.info).toHaveBeenCalledTimes(1)
    const [title, opts] = vi.mocked(toast.info).mock.calls[0]
    expect(title).toBe('Skills update available')
    expect(opts?.description).toContain('v2.9.0')
    expect(opts?.description).toContain('npx skills upgrade')
  })

  it('stays silent under the e2e harness so screenshots stay deterministic', () => {
    mockPlatform.isE2E = true
    render(<SkillsUpdateToast />)
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('stays silent while the skills version is still loading', () => {
    vi.mocked(useSkillsInfo).mockReturnValue(undefined)
    render(<SkillsUpdateToast />)
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('stays silent once the user dismissed this version', () => {
    usePreferencesStore.setState({ skillsDismissedVersion: '2.9.0' })
    render(<SkillsUpdateToast />)
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('opens Settings to Agents and records the dismissal from the action', () => {
    render(<SkillsUpdateToast />)
    const action = lastToast().action as ToastAction
    action.onClick()
    expect(useSettingsDialogStore.getState().open).toBe(true)
    expect(useSettingsDialogStore.getState().section).toBe('agents')
    expect(usePreferencesStore.getState().skillsDismissedVersion).toBe('2.9.0')
  })

  it('records the dismissal when the toast is closed', () => {
    render(<SkillsUpdateToast />)
    const onDismiss = lastToast().onDismiss
    onDismiss?.({ id: 'skills-update' } as Parameters<NonNullable<typeof onDismiss>>[0])
    expect(usePreferencesStore.getState().skillsDismissedVersion).toBe('2.9.0')
  })
})
