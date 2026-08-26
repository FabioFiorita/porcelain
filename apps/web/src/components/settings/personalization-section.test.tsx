import { copyText } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PersonalizationSection } from './personalization-section'

vi.mock('@renderer/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/lib/utils')>()),
  copyText: vi.fn(async () => undefined),
}))

describe('PersonalizationSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows one story-order instruction without pinned or hidden content', () => {
    render(<PersonalizationSection repoPath="/repo" />)

    expect(screen.getByText(/## Porcelain story order/)).toBeInTheDocument()
    expect(screen.queryByText(/pinned/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/hidden/i)).not.toBeInTheDocument()
  })

  it('copies the visible instruction with the checkout path filled in', async () => {
    render(<PersonalizationSection repoPath="/repo" />)

    fireEvent.click(screen.getByTestId(TestIds.personalizationCopyInstruction))
    await waitFor(() => expect(vi.mocked(copyText)).toHaveBeenCalledTimes(1))

    const visible = screen.getByText(/## Porcelain story order/).textContent ?? ''
    expect(copyText).toHaveBeenCalledWith(visible)
    expect(visible).toContain('/repo')
    expect(visible).toContain('Change only `layers`')
  })
})
