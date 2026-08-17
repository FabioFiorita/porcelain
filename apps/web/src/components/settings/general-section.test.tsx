import { useCommitModels } from '@renderer/features/git'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralSection } from './general-section'

vi.mock('@renderer/features/git', () => ({
  useCommitModels: vi.fn(),
}))

vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => ({ host: 'beelink', platform: 'linux', version: '0.53.2' }),
}))

describe('GeneralSection', () => {
  beforeEach(() => {
    vi.mocked(useCommitModels).mockReturnValue({
      models: [{ id: 'luna', label: 'Luna', provider: 'codex' }],
      isLoading: false,
    })
  })

  it('hosts appearance and viewer prefs, not companion skills', () => {
    render(<GeneralSection />)
    expect(screen.getByTestId('settings-connected-to')).toHaveTextContent('beelink')
    expect(screen.getByText('Appearance')).toBeTruthy()
    expect(screen.queryByText('Companion')).toBeNull()
    expect(screen.queryByText(/npx skills/)).toBeNull()
  })
})
