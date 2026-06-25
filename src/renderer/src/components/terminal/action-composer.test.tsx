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

  function renderEdit(): void {
    render(
      <ActionComposer
        open
        draft={{ id: 'a1', title: 'Dev', command: 'pnpm dev', cwd: 'apps/web' }}
        onOpenChange={vi.fn()}
      />,
    )
  }

  it('pre-fills the working-directory input from the draft', () => {
    renderEdit()
    expect(screen.getByLabelText<HTMLInputElement>('Action working directory').value).toBe(
      'apps/web',
    )
  })

  it('clears cwd as an empty string (not undefined) so the old cwd is actually cleared', async () => {
    renderEdit()
    fireEvent.change(screen.getByLabelText('Action working directory'), { target: { value: '' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // The regression guard: an empty string must survive serialization. undefined would be
    // dropped over tRPC/IPC and the main process would keep the stale cwd.
    expect(update).toHaveBeenCalledWith('a1', expect.objectContaining({ cwd: '' }))
  })

  it('passes a normal cwd value straight through on edit', async () => {
    renderEdit()
    fireEvent.change(screen.getByLabelText('Action working directory'), {
      target: { value: 'pkgs/x' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(update).toHaveBeenCalledWith('a1', expect.objectContaining({ cwd: 'pkgs/x' }))
  })
})
