import type { WorktreeProfileView } from '@porcelain/contracts/files'
import { useWorktreeProfile } from '@renderer/features/files'
import { copyText } from '@renderer/lib/utils'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { useSetupTipsStore } from '@renderer/stores/setup-tips'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isProfileUnset, ProfileSetupTip } from './profile-setup-tip'

vi.mock('@renderer/features/files', () => ({ useWorktreeProfile: vi.fn() }))
vi.mock('@renderer/stores/hub-repo', () => ({ useHubRepoPath: vi.fn() }))
vi.mock('@renderer/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/lib/utils')>()),
  copyText: vi.fn(async () => undefined),
}))

const empty: WorktreeProfileView = {
  worktreeId: 'wt-1',
  base: { pinnedPaths: [], hiddenPaths: [], layers: [] },
  override: null,
  resolved: { pinnedPaths: [], hiddenPaths: [], layers: [] },
}

const withBase = (patch: Partial<WorktreeProfileView['base']>): WorktreeProfileView => ({
  ...empty,
  base: { ...empty.base, ...patch },
})

const tip = (): HTMLElement | null => screen.queryByTestId(TestIds.filesProfileSetup)

describe('isProfileUnset', () => {
  it('is true only when neither level declares anything', () => {
    expect(isProfileUnset(empty)).toBe(true)
    expect(isProfileUnset(withBase({ pinnedPaths: ['README.md'] }))).toBe(false)
    expect(isProfileUnset(withBase({ hiddenPaths: ['dist'] }))).toBe(false)
    expect(isProfileUnset(withBase({ layers: [{ label: 'View', pattern: 'src/' }] }))).toBe(false)
  })

  /** Somebody has already been here, so the prompt is noise rather than help. */
  it('is false when this worktree has an override even with an empty baseline', () => {
    expect(
      isProfileUnset({
        ...empty,
        override: { pinnedPaths: [], hiddenPaths: [], unhiddenPaths: [], layers: null },
      }),
    ).toBe(false)
  })

  /** No flash-then-hide while the profile query is still in flight. */
  it('is false while the profile is still loading', () => {
    expect(isProfileUnset(undefined)).toBe(false)
  })
})

describe('ProfileSetupTip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSetupTipsStore.setState({ dismissed: {} })
    vi.mocked(useHubRepoPath).mockReturnValue('/repos/app/wt/feature')
    vi.mocked(useWorktreeProfile).mockReturnValue(empty)
  })

  it('prompts when the project has no profile at either level', () => {
    render(<ProfileSetupTip projectPath="/repos/app" />)

    expect(tip()).not.toBeNull()
    expect(screen.getByTestId(TestIds.filesProfileSetupProject)).toBeTruthy()
    expect(screen.getByTestId(TestIds.filesProfileSetupWorktree)).toBeTruthy()
  })

  it('stays away once the profile exists', () => {
    vi.mocked(useWorktreeProfile).mockReturnValue(withBase({ hiddenPaths: ['dist'] }))
    render(<ProfileSetupTip projectPath="/repos/app" />)

    expect(tip()).toBeNull()
  })

  it('stays away while the profile is still loading', () => {
    vi.mocked(useWorktreeProfile).mockReturnValue(undefined)
    render(<ProfileSetupTip projectPath="/repos/app" />)

    expect(tip()).toBeNull()
  })

  /** Dismissal is per project, so one "no thanks" settles it for every worktree of it. */
  it('stays away after a dismissal on the same project', () => {
    const { unmount } = render(<ProfileSetupTip projectPath="/repos/app" />)
    fireEvent.click(screen.getByTestId(TestIds.filesProfileSetupDismiss))
    expect(tip()).toBeNull()
    unmount()

    render(<ProfileSetupTip projectPath="/repos/app" />)
    expect(tip()).toBeNull()
  })

  it('still prompts on a different project after a dismissal', () => {
    useSetupTipsStore.getState().dismiss('/repos/other', 'scope-kickoff')
    render(<ProfileSetupTip projectPath="/repos/app" />)

    expect(tip()).not.toBeNull()
  })

  it('copies the project baseline prompt with the checkout path filled in', async () => {
    render(<ProfileSetupTip projectPath="/repos/app" />)

    fireEvent.click(screen.getByTestId(TestIds.filesProfileSetupProject))
    await waitFor(() => expect(vi.mocked(copyText).mock.calls.length).toBe(1))

    const copied = vi.mocked(copyText).mock.calls[0]?.[0] ?? ''
    expect(copied).toContain('`level` project')
    expect(copied).toContain('/repos/app/wt/feature')
    expect(copied).not.toContain("this checkout's absolute path")
  })

  it('copies a worktree-only prompt from the other button', async () => {
    render(<ProfileSetupTip projectPath="/repos/app" />)

    fireEvent.click(screen.getByTestId(TestIds.filesProfileSetupWorktree))
    await waitFor(() => expect(vi.mocked(copyText).mock.calls.length).toBe(1))

    const copied = vi.mocked(copyText).mock.calls[0]?.[0] ?? ''
    expect(copied).toContain('`level` worktree')
    expect(copied).toContain('/repos/app/wt/feature')
    expect(copied).not.toContain('`level` project, `op` set')
  })

  /** No repository path client-side: the prompt is still correct, just not paste-and-run. */
  it('falls back to the described path when the client does not know it', async () => {
    vi.mocked(useHubRepoPath).mockReturnValue(null)
    render(<ProfileSetupTip projectPath="/repos/app" />)

    fireEvent.click(screen.getByTestId(TestIds.filesProfileSetupProject))
    await waitFor(() => expect(vi.mocked(copyText).mock.calls.length).toBe(1))

    expect(vi.mocked(copyText).mock.calls[0]?.[0] ?? '').toContain("this checkout's absolute path")
  })
})
