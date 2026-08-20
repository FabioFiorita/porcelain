import { useCommitModels } from '@renderer/features/git'
import { TestIds } from '@shared/test-ids'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralSection } from './general-section'

vi.mock('@renderer/features/git', () => ({
  useCommitModels: vi.fn(),
}))

const environmentName = vi.fn<() => string | null>(() => null)

vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => ({ host: 'beelink', platform: 'linux', version: '0.53.2' }),
  useEnvironmentName: () => environmentName(),
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

  it('names the connected daemon by its nickname, and by its host when cleared', () => {
    environmentName.mockReturnValue('Beelink (work)')
    const { rerender } = render(<GeneralSection />)
    expect(screen.getByTestId(TestIds.settingsConnectedTo).textContent).toBe('Beelink (work)')

    environmentName.mockReturnValue(null)
    rerender(<GeneralSection />)
    expect(screen.getByTestId(TestIds.settingsConnectedTo).textContent).toBe('beelink')
  })
})
