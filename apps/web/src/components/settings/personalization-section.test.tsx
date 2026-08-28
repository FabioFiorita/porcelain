import { TestIds } from '@shared/test-ids'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PersonalizationSection } from './personalization-section'

describe('PersonalizationSection', () => {
  it('explains the human-owned navigation profile and agent-built Review order', () => {
    render(<PersonalizationSection repoPath="/repo" />)

    expect(screen.getByText(/choices you make directly in the Files tree/)).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.personalizationAgentBuilt)).toHaveTextContent(
      'Story order is built into each Review',
    )
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
    expect(screen.getByText('/repo')).toBeInTheDocument()
  })
})
