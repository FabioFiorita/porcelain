import type { RepoInfo } from '@backend/api'
import { useNewWindow, useRecentRepos, useRemoveRecentRepo } from '@renderer/hooks/use-repo'
import { useRepoStore } from '@renderer/stores/repo'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RepoIdentityButton } from './repo-identity-button'

// Same setup as the rail switcher test: no preload bridge under jsdom (isBrowser
// true by default), and components read through domain hooks — mock the hook module.
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false, isE2E: false }))

vi.mock('@renderer/hooks/use-repo', () => ({
  useRecentRepos: vi.fn(),
  useNewWindow: vi.fn(),
  useRemoveRecentRepo: vi.fn(),
}))

const recents: RepoInfo[] = [{ path: '/Users/me/code/alpha', name: 'alpha' }]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRecentRepos).mockReturnValue(recents)
  vi.mocked(useNewWindow).mockReturnValue({ openWindow: vi.fn() })
  vi.mocked(useRemoveRecentRepo).mockReturnValue({ remove: vi.fn() })
})

describe('RepoIdentityButton', () => {
  it('shows the open repo base name as the switcher trigger', () => {
    useRepoStore.setState({ repo: { path: '/Users/me/code/alpha', name: 'alpha' } })
    render(<RepoIdentityButton />)
    expect(screen.getByRole('button', { name: 'Switch project' })).toBeTruthy()
    expect(screen.getByText('alpha')).toBeTruthy()
  })

  it('renders nothing on the welcome screen (no open repo)', () => {
    useRepoStore.setState({ repo: null })
    const { container } = render(<RepoIdentityButton />)
    expect(container).toBeEmptyDOMElement()
  })
})
