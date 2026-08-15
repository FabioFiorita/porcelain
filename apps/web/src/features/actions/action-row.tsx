import type { ActionView } from '@porcelain/contracts/actions'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import {
  ArrowDown,
  ArrowUp,
  Cloud,
  Monitor,
  MoreHorizontal,
  PenLine,
  Play,
  ShieldQuestion,
  Trash2,
} from 'lucide-react'
import { useActionMutations } from './actions-mutations'

/**
 * One saved command in the Hub's Actions menu.
 *
 * The full command text is always visible before it runs — an agent can author
 * Actions, so the human must see exactly what a click executes. `readOnly` is the
 * Environment gate: a Project's commands are listed for every Environment that has
 * it, but this window can only curate and run the ones its own daemon serves.
 */
export function ActionRow({
  action,
  onEdit,
  onRun,
  showWhere,
  isFirst,
  isLast,
  readOnly = false,
}: {
  action: ActionView
  onEdit: (action: ActionView) => void
  onRun: (action: ActionView) => void
  /** When true, surface a small Cloud/Monitor cue so Play’s target is obvious. */
  showWhere: boolean
  isFirst: boolean
  isLast: boolean
  readOnly?: boolean
}): React.JSX.Element {
  const { move, remove } = useActionMutations()
  const isLocal = action.where === 'local'
  // Unreviewed commands still show their full text and still sit under one click —
  // the click just lands on the accept step instead of a shell.
  const unreviewed = !action.trusted
  return (
    <div className="group/action flex items-center gap-1 rounded-xl border bg-card p-2">
      <button
        type="button"
        onClick={() => onRun(action)}
        data-testid={TestIds.actionRun(action.title)}
        disabled={readOnly}
        className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-70"
        title={
          readOnly
            ? `Runs on another Environment: ${action.command}`
            : unreviewed
              ? `Not run on this machine yet: ${action.command}`
              : isLocal
                ? `Run on this device: ${action.command}`
                : `Run: ${action.command}`
        }
      >
        {unreviewed ? (
          <ShieldQuestion
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-label="Not run on this machine yet"
            data-testid={TestIds.actionUnreviewed(action.title)}
          />
        ) : (
          <Play className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="block truncate text-xs font-medium">{action.title}</span>
            {showWhere &&
              (isLocal ? (
                <Monitor
                  className="size-3 shrink-0 text-muted-foreground"
                  aria-label="Runs on this device"
                />
              ) : (
                <Cloud
                  className="size-3 shrink-0 text-muted-foreground"
                  aria-label="Runs on this window’s machine"
                />
              ))}
          </span>
          <span className="block truncate font-mono text-2xs text-muted-foreground">
            {action.command}
          </span>
        </span>
      </button>
      {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-5 shrink-0 opacity-0 group-hover/action:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label="Action options"
              >
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(action)}>
              <PenLine />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isFirst}
              onClick={() => {
                runUserAction(
                  () => move(action.id, 'up'),
                  (error) => {
                    toastUserActionError('Move action', error)
                  },
                )
              }}
            >
              <ArrowUp />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isLast}
              onClick={() => {
                runUserAction(
                  () => move(action.id, 'down'),
                  (error) => {
                    toastUserActionError('Move action', error)
                  },
                )
              }}
            >
              <ArrowDown />
              Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                runUserAction(
                  () => remove(action.id),
                  (error) => {
                    toastUserActionError('Delete action', error)
                  },
                )
              }}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
