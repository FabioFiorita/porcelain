import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeatureView } from './feature-view'

// Mock the domain hook, never tRPC (the component-test rule).
vi.mock('@renderer/hooks/use-feature-reading', () => ({
  useFeatureReading: vi.fn(),
}))
vi.mock('@renderer/hooks/use-reviewed', () => ({
  useReviewedPaths: () => new Set<string>(),
}))
// copyText goes through the utils helper (navigator.clipboard is absent on the
// tailnet client AND in jsdom); spy on it instead of the clipboard.
const copySpy = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@renderer/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  copyText: copySpy,
}))

describe('FeatureView', () => {
  beforeEach(() => {
    copySpy.mockClear()
  })

  it('shows a loading line while the reading is in flight', () => {
    vi.mocked(useFeatureReading).mockReturnValue({ reading: undefined, refresh: async () => {} })
    render(<FeatureView />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders the start-unit empty state when no review set exists', () => {
    vi.mocked(useFeatureReading).mockReturnValue({ reading: null, refresh: async () => {} })
    render(<FeatureView />)
    expect(screen.getByText('Start this unit of work')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy begin-unit prompt/ })).toBeInTheDocument()
  })

  it('copies the begin-unit agent prompt from the empty state', () => {
    vi.mocked(useFeatureReading).mockReturnValue({ reading: null, refresh: async () => {} })
    render(<FeatureView />)
    fireEvent.click(screen.getByRole('button', { name: /Copy begin-unit prompt/ }))
    expect(copySpy).toHaveBeenCalledWith(expect.stringContaining('START of the unit'))
    expect(copySpy).toHaveBeenCalledWith(expect.stringContaining('porcelain-companion'))
  })
})
