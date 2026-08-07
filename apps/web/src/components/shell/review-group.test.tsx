import type { FeatureReading } from '@backend/review/feature-view'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useReviewComments } from '@renderer/hooks/use-comments'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { useReviewFocusStore } from '@renderer/stores/review-focus'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { firstProseLine, ReviewGroup } from './review-group'

vi.mock('@renderer/hooks/use-feature-reading', () => ({
  useFeatureReading: vi.fn(),
}))
vi.mock('@renderer/hooks/use-comments', () => ({
  useReviewComments: vi.fn(),
}))
vi.mock('@renderer/hooks/use-reviewed', () => ({
  useReviewedPaths: () => new Set<string>(),
}))
const clearSpy = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@renderer/hooks/use-review-intent', () => ({
  useReviewPublishCost: (): { bytes: number; files: number } => ({ bytes: 0, files: 0 }),
  usePublishReview: (): { publish: () => Promise<null>; isPublishing: boolean } => ({
    publish: async () => null,
    isPublishing: false,
  }),
}))
vi.mock('@renderer/hooks/use-companion-dispositions', () => ({
  useCompanionGitVisibility: (): { data: { hidden: boolean }; isPending: boolean } => ({
    data: { hidden: false },
    isPending: false,
  }),
}))
vi.mock('@renderer/hooks/use-feature-view', () => ({
  useClearFeatureReview: () => ({ clear: clearSpy, isClearing: false }),
  useArchivedReviews: () => [],
  useArchivedReviewActions: () => ({
    restore: vi.fn(),
    remove: vi.fn(),
    isBusy: false,
  }),
}))

const reading: FeatureReading = {
  name: 'Crew call-outs',
  thesis: 'One paragraph of intent.',
  sections: [
    {
      title: 'Entry point',
      prose: '## Where it starts\n\nBody.',
      files: [],
    },
  ],
  groups: [],
  evidence: null,
}

function renderGroup(): void {
  render(
    <SidebarProvider>
      <ReviewGroup />
    </SidebarProvider>,
  )
}

describe('firstProseLine', () => {
  it('returns the first non-empty line without a heading marker', () => {
    expect(firstProseLine('## Title\n\nBody')).toBe('Title')
    expect(firstProseLine('  plain  ')).toBe('plain')
    expect(firstProseLine('\n\n')).toBeNull()
  })
})

describe('ReviewGroup', () => {
  beforeEach(() => {
    clearSpy.mockClear()
    useReviewFocusStore.setState({
      canvasTab: 'intent',
      activeSection: null,
      visiblePath: null,
      jump: null,
    })
    vi.mocked(useReviewComments).mockReturnValue([])
    vi.mocked(useFeatureReading).mockReturnValue({ reading, refresh: async () => {} })
  })

  it('shows the empty companion when no review is published', () => {
    vi.mocked(useFeatureReading).mockReturnValue({ reading: null, refresh: async () => {} })
    renderGroup()
    expect(screen.getByText(/Start a unit/)).toBeInTheDocument()
    expect(screen.queryByText('Archive review & evidence')).not.toBeInTheDocument()
  })

  it('shows Current review and the Archive review button', () => {
    renderGroup()
    expect(screen.getByText('Current review')).toBeInTheDocument()
    expect(screen.getAllByText('Crew call-outs').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(/In progress/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('feature-clear-review')).toBeInTheDocument()
  })

  it('always shows Previous reviews, with a note when nothing is archived', () => {
    renderGroup()
    expect(screen.getByText('Previous reviews')).toBeInTheDocument()
    expect(screen.getByText(/No previous reviews yet/)).toBeInTheDocument()
  })

  it('shows Previous reviews in the empty-reading state too', () => {
    vi.mocked(useFeatureReading).mockReturnValue({ reading: null, refresh: async () => {} })
    renderGroup()
    expect(screen.getByText('Previous reviews')).toBeInTheDocument()
    expect(screen.getByText(/No previous reviews yet/)).toBeInTheDocument()
  })

  it('archives only after AlertDialog confirm', () => {
    renderGroup()
    fireEvent.click(screen.getByTestId('feature-clear-review'))
    expect(clearSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Confirm archive review and evidence'))
    expect(clearSpy).toHaveBeenCalledTimes(1)
  })
})
