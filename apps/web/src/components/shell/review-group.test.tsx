import type { ReviewReading } from '@porcelain/contracts/review'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useReviewComments, useReviewFocusStore, useReviewReading } from '@renderer/features/review'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { firstProseLine, ReviewGroup } from './review-group'

vi.mock('@renderer/features/git', () => ({
  useReviewedPaths: () => new Set<string>(),
}))
const clearSpy = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@renderer/features/review', async () => {
  // The focus store is real presentation state the assertions drive; importing it from its own
  // module avoids re-entering the mocked feature entry.
  const focus = await vi.importActual<
    typeof import('@renderer/features/review/review-focus-store')
  >('@renderer/features/review/review-focus-store')
  return {
    useReviewFocusStore: focus.useReviewFocusStore,
    useReviewReading: vi.fn(),
    useReviewComments: vi.fn(),
    useReviewPublishCost: (): { bytes: number; files: number } => ({ bytes: 0, files: 0 }),
    usePublishReview: (): { publish: () => Promise<null>; isPublishing: boolean } => ({
      publish: async () => null,
      isPublishing: false,
    }),
    useArchiveReview: () => ({ archive: clearSpy, isArchiving: false }),
    useArchivedReviews: () => [],
    useRestoreArchivedReview: () => ({ restore: vi.fn(), isRestoring: false }),
    useDeleteArchivedReview: () => ({ remove: vi.fn(), isRemoving: false }),
  }
})
vi.mock('@renderer/features/project-data', () => ({
  useCompanionGitVisibility: (): { data: { hidden: boolean }; isPending: boolean } => ({
    data: { hidden: false },
    isPending: false,
  }),
}))

const reading: ReviewReading = {
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
    vi.mocked(useReviewReading).mockReturnValue({ reading, refresh: async () => {} })
  })

  it('shows the empty companion when no review is published', () => {
    vi.mocked(useReviewReading).mockReturnValue({ reading: null, refresh: async () => {} })
    renderGroup()
    expect(screen.getByText(/Start a unit/)).toBeInTheDocument()
    expect(screen.queryByText('Archive review & evidence')).not.toBeInTheDocument()
  })

  it('shows Current review and the Archive review button', () => {
    renderGroup()
    expect(screen.getByText('Current review')).toBeInTheDocument()
    expect(screen.getAllByText('Crew call-outs').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(/In progress/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('review-archive')).toBeInTheDocument()
  })

  it('always shows Previous reviews, with a note when nothing is archived', () => {
    renderGroup()
    expect(screen.getByText('Previous reviews')).toBeInTheDocument()
    expect(screen.getByText(/No previous reviews yet/)).toBeInTheDocument()
  })

  it('shows Previous reviews in the empty-reading state too', () => {
    vi.mocked(useReviewReading).mockReturnValue({ reading: null, refresh: async () => {} })
    renderGroup()
    expect(screen.getByText('Previous reviews')).toBeInTheDocument()
    expect(screen.getByText(/No previous reviews yet/)).toBeInTheDocument()
  })

  it('archives only after AlertDialog confirm', () => {
    renderGroup()
    fireEvent.click(screen.getByTestId('review-archive'))
    expect(clearSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Confirm archive review and evidence'))
    expect(clearSpy).toHaveBeenCalledTimes(1)
  })
})
