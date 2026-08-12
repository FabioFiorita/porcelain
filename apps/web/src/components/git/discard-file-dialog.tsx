import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'

/**
 * Confirmation for a discard, worded for what discard actually does to this file: a new file
 * (no committed version) is trashed and recoverable, a tracked one is reverted and is not.
 */
export function DiscardFileDialog({
  name,
  isNew,
  open,
  onOpenChange,
  onConfirm,
}: {
  name: string
  isNew: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {isNew
              ? `This moves the new file “${name}” to the Trash — you can restore it from there.`
              : `This reverts “${name}” to the last commit. Uncommitted changes cannot be recovered.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
