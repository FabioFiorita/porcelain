import { useSetLocalTerminalPath } from '@renderer/hooks/use-local-terminal'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalPathDialog } from './local-path-dialog'

vi.mock('@renderer/hooks/use-local-terminal', () => ({
  useSetLocalTerminalPath: vi.fn(),
}))

describe('LocalPathDialog', () => {
  const save = vi.fn(async () => {})
  const onSaved = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSetLocalTerminalPath).mockReturnValue({ save, isPending: false })
  })

  it('labels the primary action "Open terminal" when mapping for a spawn', () => {
    render(
      <LocalPathDialog
        repoPath="/home/you/code/app"
        initialPath={null}
        mode="spawn"
        onSaved={onSaved}
        onClose={onClose}
      />,
    )
    expect(screen.getByRole('button', { name: 'Open terminal' })).toBeInTheDocument()
  })

  it('labels the primary action "Save" when editing an existing map', () => {
    render(
      <LocalPathDialog
        repoPath="/home/you/code/app"
        initialPath="/Users/you/code/app"
        mode="edit"
        onSaved={onSaved}
        onClose={onClose}
      />,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('prefills the field and persists the trimmed path on save', async () => {
    render(
      <LocalPathDialog
        repoPath="/home/you/code/app"
        initialPath="/Users/you/old"
        mode="edit"
        onSaved={onSaved}
        onClose={onClose}
      />,
    )
    const input = screen.getByLabelText<HTMLInputElement>('Local folder')
    expect(input.value).toBe('/Users/you/old')
    fireEvent.change(input, { target: { value: '  /Users/you/code/app  ' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(save).toHaveBeenCalledWith({
      repoPath: '/home/you/code/app',
      localPath: '/Users/you/code/app',
    })
    expect(onSaved).toHaveBeenCalledWith('/Users/you/code/app')
    expect(onClose).toHaveBeenCalled()
  })
})
