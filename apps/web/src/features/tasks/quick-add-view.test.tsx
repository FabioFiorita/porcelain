import { TestIds } from '@shared/test-ids'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QuickAddView } from './quick-add-view'
import { renderTasks } from './test-support'

describe('QuickAddView', () => {
  it('creates a Task on this device from title and notes', async () => {
    const { mock } = renderTasks(<QuickAddView />)

    fireEvent.change(screen.getByTestId(TestIds.quickAddTitle), {
      target: { value: 'Ship the tray' },
    })
    fireEvent.change(screen.getByTestId(TestIds.quickAddNotes), {
      target: { value: 'From the menu bar' },
    })
    fireEvent.click(screen.getByTestId(TestIds.quickAddSubmit))

    await waitFor(() => {
      expect(mock.requests().some((request) => request.procedure === 'createTask')).toBe(true)
    })
    const created = mock.requests().find((request) => request.procedure === 'createTask')
    // No references: the popover files an unreferenced daemon-wide Task rather than
    // guessing a project it cannot show the human.
    expect(created?.input).toEqual({ title: 'Ship the tray', notes: 'From the menu bar' })
    await screen.findByTestId(TestIds.quickAddConfirmation)
  })

  it('submits on Enter in the title field', async () => {
    const { mock } = renderTasks(<QuickAddView />)
    fireEvent.change(screen.getByTestId(TestIds.quickAddTitle), { target: { value: 'Catch it' } })
    fireEvent.keyDown(screen.getByTestId(TestIds.quickAddTitle), { key: 'Enter' })
    await waitFor(() => {
      expect(mock.requests().some((request) => request.procedure === 'createTask')).toBe(true)
    })
  })

  it('refuses an empty title without calling the daemon', () => {
    const { mock } = renderTasks(<QuickAddView />)
    fireEvent.click(screen.getByTestId(TestIds.quickAddSubmit))
    expect(mock.requests().some((request) => request.procedure === 'createTask')).toBe(false)
    expect(screen.getByText('A Task needs a title.')).toBeInTheDocument()
  })
})
