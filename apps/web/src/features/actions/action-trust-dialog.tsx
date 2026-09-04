import type { ActionView } from '@porcelain/contracts/actions'
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
 * Shown before an unreviewed command runs for the first time.
 *
 * A command can be written by an agent or changed after the human last accepted it.
 * The command text is the thing that
 * executes, so the command text is the thing being accepted here — in full, not
 * truncated, and never pre-scrolled past.
 *
 * This gate protects attention, not privilege: whoever holds a daemon credential
 * can already open a terminal and type anything. What it stops is a human
 * one-clicking something they assumed was their own.
 */
export function ActionTrustDialog({
  action,
  environmentName,
  onCancel,
  onTrust,
}: {
  action: ActionView | null
  environmentName?: string
  onCancel: () => void
  onTrust: (action: ActionView) => void
}): React.JSX.Element | null {
  if (action === null) return null
  return (
    <AlertDialog open onOpenChange={(open: boolean) => !open && onCancel()}>
      <AlertDialogContent data-testid={TestIds.actionTrustDialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>Review “{action.title}” before running?</AlertDialogTitle>
          <AlertDialogDescription>
            This exact command has not been accepted on this machine. It may have been added by an
            agent or changed since you last reviewed it. It runs in a visible terminal as you
            {environmentName === undefined ? '.' : ` on ${environmentName}.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <pre
          className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-3 font-mono text-2xs"
          data-testid={TestIds.actionTrustCommand}
        >
          {action.command}
        </pre>
        <AlertDialogDescription className="text-2xs">
          Accepting remembers this exact command on this machine only. Change it later — by hand, by
          an agent, or by a teammate’s commit — and it asks again.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onTrust(action)}
            data-testid={TestIds.actionTrustConfirm}
          >
            Run and remember
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
