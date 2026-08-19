import type { WorktreeProfileView } from '@porcelain/contracts/files'
import { useWorktreeProfile } from '@renderer/features/files'
import { copyText } from '@renderer/lib/utils'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PersonalizationSection } from './personalization-section'

vi.mock('@renderer/features/files', () => ({ useWorktreeProfile: vi.fn() }))
vi.mock('@renderer/stores/hub-repo', () => ({ useHubRepoPath: vi.fn() }))
vi.mock('@renderer/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/lib/utils')>()),
  copyText: vi.fn(async () => undefined),
}))

const inheriting: WorktreeProfileView = {
  worktreeId: 'wt-1',
  base: {
    pinnedPaths: ['README.md'],
    hiddenPaths: ['dist'],
    layers: [
      { label: 'View', pattern: 'components/' },
      { label: 'Service', pattern: 'services/' },
    ],
  },
  override: null,
  resolved: {
    pinnedPaths: ['README.md'],
    hiddenPaths: ['dist'],
    layers: [
      { label: 'View', pattern: 'components/' },
      { label: 'Service', pattern: 'services/' },
    ],
  },
}

function withOverride(): WorktreeProfileView {
  return {
    ...inheriting,
    override: {
      pinnedPaths: ['apps/mobile/src/screen.tsx'],
      hiddenPaths: ['apps/web'],
      unhiddenPaths: ['dist'],
      layers: [{ label: 'Screen', pattern: 'screens/' }],
    },
  }
}

const base = (): HTMLElement => screen.getByTestId(TestIds.personalizationBase)
const override = (): HTMLElement => screen.getByTestId(TestIds.personalizationOverride)

describe('PersonalizationSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useHubRepoPath).mockReturnValue('/repo')
    vi.mocked(useWorktreeProfile).mockReturnValue(inheriting)
  })

  it('shows the project baseline, since that is what an un-overridden worktree applies', () => {
    render(<PersonalizationSection />)

    expect(base().textContent).toContain('README.md')
    expect(base().textContent).toContain('dist')
  })

  it('reads layer order as a sequence, not an alphabetical list', () => {
    render(<PersonalizationSection />)

    expect(base().textContent).toContain('View → Service')
  })

  /**
   * The whole reason the two levels are rendered apart: a reader who cannot tell
   * inherited focus from worktree-added focus cannot decide which one to change.
   */
  it('says plainly when a worktree is inheriting rather than showing empty lists', () => {
    render(<PersonalizationSection />)

    expect(override().textContent).toContain('No override')
    expect(override().textContent).not.toContain('Also pinned')
  })

  it('separates what this worktree added from what the project declares', () => {
    vi.mocked(useWorktreeProfile).mockReturnValue(withOverride())
    render(<PersonalizationSection />)

    expect(override().textContent).toContain('apps/mobile/src/screen.tsx')
    expect(base().textContent).not.toContain('apps/mobile/src/screen.tsx')
    expect(base().textContent).toContain('README.md')
  })

  it('shows a worktree that opted out of a project hide', () => {
    vi.mocked(useWorktreeProfile).mockReturnValue(withOverride())
    render(<PersonalizationSection />)

    expect(override().textContent).toContain('Shown despite the project hiding them')
  })

  it('shows the override layer order in place of the project one', () => {
    vi.mocked(useWorktreeProfile).mockReturnValue(withOverride())
    render(<PersonalizationSection />)

    expect(override().textContent).toContain('Screen')
    expect(override().textContent).not.toContain('View → Service')
  })

  /**
   * The prompts ARE the affordance for layers — Porcelain never writes a profile
   * on its own (ADR 0003), so a copy button that copies nothing is the whole
   * feature failing silently.
   */
  it('copies a starter prompt that reads the repo instead of naming a language', async () => {
    render(<PersonalizationSection />)

    fireEvent.click(screen.getByTestId(TestIds.personalizationCopyStarter))
    await waitFor(() => expect(vi.mocked(copyText).mock.calls.length).toBe(1))

    const copied = vi.mocked(copyText).mock.calls[0]?.[0] ?? ''
    expect(copied).toContain('porcelain_profile')
    expect(copied).toContain('`level` project')
    expect(copied).not.toContain('porcelain profile set')
    expect(copied).toContain('.gitignore')
    expect(copied).not.toContain('node_modules')
  })

  it('copies a keeper prompt that tells the agent to re-focus the worktree', async () => {
    render(<PersonalizationSection />)

    fireEvent.click(screen.getByTestId(TestIds.personalizationCopyKeeper))
    await waitFor(() => expect(vi.mocked(copyText).mock.calls.length).toBe(1))

    const copied = vi.mocked(copyText).mock.calls[0]?.[0] ?? ''
    expect(copied).toContain('porcelain_profile')
    expect(copied).toContain('`level` worktree')
    expect(copied).toContain('`op` clear')
    expect(copied).not.toContain('porcelain worktree profile')
  })

  it('asks for a repository rather than rendering an empty profile', () => {
    vi.mocked(useHubRepoPath).mockReturnValue(null)
    render(<PersonalizationSection />)

    expect(screen.getByText(/Open a repository/)).toBeTruthy()
    expect(screen.queryByTestId(TestIds.personalizationBase)).toBeNull()
  })
})
