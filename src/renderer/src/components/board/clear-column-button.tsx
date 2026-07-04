import type { CardStatus } from '@backend/board-store'
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
import { Button } from '@renderer/components/ui/button'
import { STATUS_LABEL, useCardActions } from '@renderer/hooks/use-board'
import { Eraser } from 'lucide-react'
import { useState } from 'react'

/**
 * Clears every card in a column in one shot — the human's bulk equivalent of the
 * agent's delete_card, used to empty the Done pile once work has shipped. Confirms
 * first because board cards (unlike trashed files) aren't recoverable. Renders
 * nothing while the column is empty. Shared by the sidebar list + the wide board.
 */
export function ClearColumnButton({
  status,
  count,
  className,
}: {
  status: CardStatus
  count: number
  className?: string
}): React.JSX.Element | null {
  const { clear } = useCardActions()
  const [confirm, setConfirm] = useState(false)
  if (count === 0) return null
  const label = STATUS_LABEL[status]
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className={className}
        aria-label={`Clear ${label}`}
        onClick={() => setConfirm(true)}
      >
        <Eraser />
      </Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {count} {count === 1 ? 'card' : 'cards'} in “{label}”. This
              can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => clear(status)}>Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
