import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeatureView } from './feature-view'

// Mock the domain hook, never tRPC (the component-test rule).
vi.mock('@renderer/hooks/use-feature-reading', () => ({
  useFeatureReading: vi.fn(),
}))
vi.mock('@renderer/hooks/use-reviewed', () => ({
  useReviewedPaths: () => new Set<string>(),
}))
describe('FeatureView', () => {
  it('shows a loading line while the reading is in flight', () => {
    vi.mocked(useFeatureReading).mockReturnValue({ reading: undefined, refresh: async () => {} })
    render(<FeatureView />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders the start-unit empty state when no review set exists', () => {
    vi.mocked(useFeatureReading).mockReturnValue({ reading: null, refresh: async () => {} })
    render(<FeatureView />)
    expect(screen.getByText('Start this unit of work')).toBeInTheDocument()
    // The lifecycle is agent-side now — the canvas names the skill, it doesn't ship a prompt.
    expect(screen.getByText(/porcelain-companion skill/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /prompt/i })).not.toBeInTheDocument()
  })
})
