import { useCommitModels } from '@renderer/hooks/use-commit'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralSection } from './general-section'

vi.mock('@renderer/hooks/use-commit', () => ({
  useCommitModels: vi.fn(),
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
    expect(screen.getByText('Appearance')).toBeTruthy()
    expect(screen.queryByText('Companion')).toBeNull()
    expect(screen.queryByText(/npx skills/)).toBeNull()
  })
})
