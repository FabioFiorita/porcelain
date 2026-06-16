import { useRepoNotes, useSetRepoNotes } from '@renderer/hooks/use-repo-notes'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotesCard } from './notes-card'

// Convention: mock the domain hook, never tRPC. useRepoNotes feeds the initial
// markdown; useSetRepoNotes captures autosave writes.
vi.mock('@renderer/hooks/use-repo-notes', () => ({
  useRepoNotes: vi.fn(),
  useSetRepoNotes: vi.fn(),
}))

describe('NotesCard', () => {
  beforeEach(() => {
    vi.mocked(useSetRepoNotes).mockReturnValue({ save: vi.fn() })
  })

  it('shows a loading hint until notes resolve', () => {
    vi.mocked(useRepoNotes).mockReturnValue(undefined)
    render(<NotesCard />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders the stored markdown as rich text once loaded', async () => {
    vi.mocked(useRepoNotes).mockReturnValue('# Roadmap\n\nShip the notes card')
    render(<NotesCard />)
    // markdown is parsed into the WYSIWYG document
    const heading = await screen.findByRole('heading', { name: 'Roadmap' })
    expect(heading).toBeInTheDocument()
    expect(screen.getByText('Ship the notes card')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('accepts a repoPath and renders the editor', async () => {
    vi.mocked(useRepoNotes).mockReturnValue('note')
    render(<NotesCard repoPath="/repo-a" />)
    expect(await screen.findByText('note')).toBeInTheDocument()
  })
})
