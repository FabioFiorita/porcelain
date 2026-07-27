import { useActionMutations } from '@renderer/hooks/use-actions'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionComposer } from './action-composer'

// Same convention as the git list tests: mock the domain hook, never tRPC. The
// composer reaches the store only through useActionMutations, so spying on its
// add/update lets us assert exactly what fields cross the IPC seam.
vi.mock('@renderer/hooks/use-actions', () => ({ useActionMutations: vi.fn() }))

describe('ActionComposer', () => {
  const add = vi.fn(async () => {})
  const update = vi.fn(async () => {})
  const move = vi.fn(async () => {})
  const remove = vi.fn(async () => {})

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useActionMutations).mockReturnValue({ add, update, move, remove })
  })

  function renderEdit(where: 'primary' | 'local' = 'primary'): void {
    render(
      <ActionComposer
        open
        showWhere
        draft={{ id: 'a1', title: 'Dev', command: 'pnpm dev', where }}
        onOpenChange={vi.fn()}
      />,
    )
  }

  it('has no working-directory field', () => {
    renderEdit()
    expect(screen.queryByLabelText('Action working directory')).toBeNull()
  })

  it('shows the where toggle when showWhere is true', () => {
    renderEdit()
    expect(screen.getByTestId('action-where')).toBeInTheDocument()
    expect(screen.getByLabelText('Run on this window’s machine')).toBeInTheDocument()
    expect(screen.getByLabelText('Run on this device')).toBeInTheDocument()
  })

  it('hides the where toggle when showWhere is false', () => {
    render(
      <ActionComposer
        open
        showWhere={false}
        draft={{ id: 'a1', title: 'Dev', command: 'pnpm dev', where: 'primary' }}
        onOpenChange={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('action-where')).toBeNull()
  })

  it('saves where: local when selected on edit', async () => {
    renderEdit('primary')
    fireEvent.click(screen.getByLabelText('Run on this device'))
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(update).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ title: 'Dev', command: 'pnpm dev', where: 'local' }),
    )
  })

  it('sends where: primary when toggling back from local', async () => {
    renderEdit('local')
    fireEvent.click(screen.getByLabelText('Run on this window’s machine'))
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(update).toHaveBeenCalledWith('a1', expect.objectContaining({ where: 'primary' }))
  })
})
