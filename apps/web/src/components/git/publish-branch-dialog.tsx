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
import { TestIds } from '@shared/test-ids'

/**
 * First-publish confirmation: this branch has no same-named remote (or still
 * tracks a differently named one such as origin/main). Confirming creates
 * origin/<branch> and switches tracking to it.
 */
export function PublishBranchDialog({
  branch,
  upstream,
  open,
  onOpenChange,
  onConfirm,
}: {
  branch: string
  upstream: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}): React.JSX.Element {
  const remote = `origin/${branch}`
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid={TestIds.publishBranchDialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish {branch}?</AlertDialogTitle>
          <AlertDialogDescription>
            {upstream === null
              ? `This branch has no remote yet. Push will create ${remote} and set it as the upstream.`
              : `This branch tracks ${upstream}, not a remote of the same name. Push will create ${remote} and switch tracking to it.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid={TestIds.publishBranchConfirm} onClick={onConfirm}>
            Publish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
