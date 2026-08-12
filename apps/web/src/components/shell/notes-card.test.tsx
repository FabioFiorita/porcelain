import { useProjectNotes, useSetProjectNotes } from '@renderer/hooks/use-project-notes'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotesCard } from './notes-card'

// Convention: mock the domain hook, never tRPC. useProjectNotes feeds the initial
// markdown; useSetProjectNotes captures autosave writes.
vi.mock('@renderer/hooks/use-project-notes', () => ({
  useProjectNotes: vi.fn(),
  useSetProjectNotes: vi.fn(),
}))

describe('NotesCard', () => {
  beforeEach(() => {
    vi.mocked(useSetProjectNotes).mockReturnValue({ save: vi.fn() })
  })

  it('shows a loading hint until notes resolve', () => {
    vi.mocked(useProjectNotes).mockReturnValue(undefined)
    render(<NotesCard />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders the stored markdown as rich text once loaded', async () => {
    vi.mocked(useProjectNotes).mockReturnValue('# Roadmap\n\nShip the notes card')
    render(<NotesCard />)
    // markdown is parsed into the WYSIWYG document
    const heading = await screen.findByRole('heading', { name: 'Roadmap' })
    expect(heading).toBeInTheDocument()
    expect(screen.getByText('Ship the notes card')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('accepts a projectPath and renders the editor', async () => {
    vi.mocked(useProjectNotes).mockReturnValue('note')
    render(<NotesCard projectPath="/repo-a" />)
    expect(await screen.findByText('note')).toBeInTheDocument()
  })
})
