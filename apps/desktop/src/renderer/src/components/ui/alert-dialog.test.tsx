import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog'

// Guards the base-ui port fix: base-ui's alert-dialog has no `Action` part, so a bare
// <Button> confirm never closed the dialog (the "delete modal keeps opening but nothing
// happens" bug). AlertDialogAction is built on `Close`, so a confirm click must BOTH run
// its onClick AND dismiss the dialog. Re-apply/keep this if `shadcn add alert-dialog`
// ever overwrites ui/alert-dialog.tsx.
describe('AlertDialogAction', () => {
  it('runs its onClick and dismisses the dialog on confirm', () => {
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn()
    render(
      <AlertDialog open onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>This moves it to the Trash.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    // base-ui calls onOpenChange(open, eventDetails?...) — assert some call closed it.
    expect(onOpenChange.mock.calls.some((call) => call[0] === false)).toBe(true)
  })
})
