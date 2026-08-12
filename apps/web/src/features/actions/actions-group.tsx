import type { ActionView } from '@porcelain/contracts/actions'
import {
  LocalPathDialog,
  type LocalPathDialogMode,
} from '@renderer/components/terminal/local-path-dialog'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useLocalDaemon, useLocalTerminalPath } from '@renderer/hooks/use-local-terminal'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
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
  Plus,
  ShieldQuestion,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { ActionComposer, type ActionDraft, draftFromAction } from './action-composer'
import { useActionRun } from './action-run'
import { useActionRunStore } from './action-run-store'
import { ActionTrustDialog } from './action-trust-dialog'
import { useActionMutations, useTrustAction } from './actions-mutations'
import { useActions } from './actions-queries'

function ActionRow({
  action,
  onEdit,
  onRun,
  showWhere,
  isFirst,
  isLast,
}: {
  action: ActionView
  onEdit: (action: ActionView) => void
  onRun: (action: ActionView) => void
  /** When true, surface a small Cloud/Monitor cue so Play’s target is obvious. */
  showWhere: boolean
  isFirst: boolean
  isLast: boolean
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
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        // The full command is always visible before it runs — an agent can author
        // actions, so the human must see exactly what a click executes (see audit skill).
        title={
          unreviewed
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
    </div>
  )
}

/**
 * The Actions Quick Access section (Terminal tab active): the project's saved
 * commands, one click from running. The agent curates these via the porcelain
 * CLI; the human runs them. Mirrors the Comments/Board sections.
 *
 * On a remote-bound window, each action can target This device instead of the
 * primary daemon — same dual-machine model as the Terminal list's + menu.
 */
export function ActionsGroup(): React.JSX.Element {
  const actions = useActions()
  const runAction = useActionRun()
  const project = useProjectSelectionStore((s) => s.project)
  const localDaemon = useLocalDaemon()
  const canSpawnLocal = localDaemon !== undefined && !localDaemon.isLocal && project !== null
  const mappedLocalPath = useLocalTerminalPath(project?.path ?? null)
  const [draft, setDraft] = useState<ActionDraft | null>(null)
  // When a local-targeted action needs the folder map first: hold the action and open
  // the path dialog in 'run' mode; on save, run with the just-saved path. Also fed by
  // the file finder via useActionRunStore (compose-intent).
  const [pendingLocal, setPendingLocal] = useState<ActionView | null>(null)
  // Held while the human reads a command they have not run here before.
  const [pendingTrust, setPendingTrust] = useState<ActionView | null>(null)
  const trustAction = useTrustAction()
  const [mappingMode, setMappingMode] = useState<LocalPathDialogMode | null>(null)
  const storePending = useActionRunStore((s) => s.pendingLocal)
  const clearStorePending = useActionRunStore((s) => s.clearPendingLocal)

  useEffect(() => {
    if (storePending === null) return
    setPendingLocal(storePending)
    setMappingMode('run')
    clearStorePending()
  }, [storePending, clearStorePending])

  const spawn = (action: ActionView, localPath?: string | null): void => {
    runUserAction(
      async () => {
        const result = await runAction(action, {
          localPath: localPath ?? mappedLocalPath,
        })
        if (result === 'needs-local-path') {
          setPendingLocal(action)
          setMappingMode('run')
        }
        // needs-trust is handled by handleRun / trust dialog before prepare.
      },
      (error) => {
        toastUserActionError('Run command', error)
      },
    )
  }

  /**
   * A command this machine has never accepted goes to the review step instead of
   * a shell. Everything already accepted runs exactly as before — the gate must
   * cost nothing on the path people use fifty times a day, or it trains them to
   * click through it.
   */
  const handleRun = (action: ActionView, localPath?: string | null): void => {
    if (!action.trusted) {
      setPendingTrust(action)
      return
    }
    spawn(action, localPath)
  }

  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="flex items-center justify-between px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Saved commands
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-5"
          aria-label="Add action"
          data-testid={TestIds.actionsAdd}
          onClick={() => setDraft({ title: '', command: '', where: 'primary' })}
        >
          <Plus />
        </Button>
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-1.5 px-1">
        {actions.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            Save a command — a dev server, storybook, a test watcher — and run it in a terminal with
            one click. Your agent can add them too.
          </p>
        ) : (
          actions.map((action, index) => (
            <ActionRow
              key={action.id}
              action={action}
              onEdit={(a: ActionView): void => setDraft(draftFromAction(a))}
              onRun={handleRun}
              showWhere={canSpawnLocal}
              isFirst={index === 0}
              isLast={index === actions.length - 1}
            />
          ))
        )}
      </SidebarGroupContent>
      <ActionTrustDialog
        action={pendingTrust}
        onCancel={() => setPendingTrust(null)}
        onTrust={(action: ActionView): void => {
          setPendingTrust(null)
          runUserAction(
            async () => {
              await trustAction(action.id)
              // List refetch is async; prepare requires trusted — pass explicit true.
              spawn({ ...action, trusted: true })
            },
            (error) => {
              toastUserActionError('Accept command', error)
            },
          )
        }}
      />
      <ActionComposer
        draft={draft}
        open={draft !== null}
        showWhere={canSpawnLocal}
        onOpenChange={(open: boolean): void => {
          if (!open) setDraft(null)
        }}
      />
      {mappingMode && project && pendingLocal && (
        <LocalPathDialog
          key={`run:${pendingLocal.id}`}
          repoPath={project.path}
          initialPath={mappedLocalPath ?? null}
          mode={mappingMode}
          onSaved={(localPath: string): void => {
            const action = pendingLocal
            setPendingLocal(null)
            setMappingMode(null)
            spawn(action, localPath)
          }}
          onClose={() => {
            setPendingLocal(null)
            setMappingMode(null)
          }}
        />
      )}
    </SidebarGroup>
  )
}
