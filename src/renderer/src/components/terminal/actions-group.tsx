import type { Action } from '@backend/actions-store'
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
import { useActionMutations, useActions, useRunAction } from '@renderer/hooks/use-actions'
import { useLocalDaemon, useLocalTerminalPath } from '@renderer/hooks/use-local-terminal'
import { useActionRunStore } from '@renderer/stores/action-run'
import { useRepoStore } from '@renderer/stores/repo'
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
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { ActionComposer, type ActionDraft, draftFromAction } from './action-composer'

function ActionRow({
  action,
  onEdit,
  onRun,
  showWhere,
  isFirst,
  isLast,
}: {
  action: Action
  onEdit: (action: Action) => void
  onRun: (action: Action) => void
  /** When true, surface a small Cloud/Monitor cue so Play’s target is obvious. */
  showWhere: boolean
  isFirst: boolean
  isLast: boolean
}): React.JSX.Element {
  const { move, remove } = useActionMutations()
  const isLocal = action.where === 'local'
  return (
    <div className="group/action flex items-center gap-1 rounded-xl border bg-card p-2">
      <button
        type="button"
        onClick={() => onRun(action)}
        data-testid={TestIds.actionRun(action.title)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        // The full command is always visible before it runs — an agent can author
        // actions, so the human must see exactly what a click executes (see audit skill).
        title={isLocal ? `Run on this device: ${action.command}` : `Run: ${action.command}`}
      >
        <Play className="size-3.5 shrink-0 text-muted-foreground" />
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
          <DropdownMenuItem disabled={isFirst} onClick={() => move(action.id, 'up')}>
            <ArrowUp />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isLast} onClick={() => move(action.id, 'down')}>
            <ArrowDown />
            Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => remove(action.id)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/**
 * The Actions Quick Access section (shown when the Terminal tab is active): the repo's
 * saved commands, each one click from running in a terminal. The agent can curate these
 * via the porcelain CLI; the human runs them. Mirrors the Comments/Board sections.
 *
 * On a remote-bound Electron window, each action can target This device (the machine
 * running the app) instead of the primary daemon — same dual-machine model as the
 * Terminal list's + menu.
 */
export function ActionsGroup(): React.JSX.Element {
  const actions = useActions()
  const runAction = useRunAction()
  const repo = useRepoStore((s) => s.repo)
  const localDaemon = useLocalDaemon()
  const canSpawnLocal = localDaemon !== undefined && !localDaemon.isLocal && repo !== null
  const mappedLocalPath = useLocalTerminalPath(repo?.path ?? null)
  const [draft, setDraft] = useState<ActionDraft | null>(null)
  // When a local-targeted action needs the folder map first: hold the action and open
  // the path dialog in 'run' mode; on save, run with the just-saved path. Also fed by
  // the file finder via useActionRunStore (compose-intent).
  const [pendingLocal, setPendingLocal] = useState<Action | null>(null)
  const [mappingMode, setMappingMode] = useState<LocalPathDialogMode | null>(null)
  const storePending = useActionRunStore((s) => s.pendingLocal)
  const clearStorePending = useActionRunStore((s) => s.clearPendingLocal)

  useEffect(() => {
    if (storePending === null) return
    setPendingLocal(storePending)
    setMappingMode('run')
    clearStorePending()
  }, [storePending, clearStorePending])

  const run = async (action: Action, localPath?: string | null): Promise<void> => {
    const result = await runAction(action, {
      localPath: localPath ?? mappedLocalPath,
    })
    if (result === 'needs-local-path') {
      setPendingLocal(action)
      setMappingMode('run')
    }
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
              onEdit={(a) => setDraft(draftFromAction(a))}
              onRun={run}
              showWhere={canSpawnLocal}
              isFirst={index === 0}
              isLast={index === actions.length - 1}
            />
          ))
        )}
      </SidebarGroupContent>
      <ActionComposer
        draft={draft}
        open={draft !== null}
        showWhere={canSpawnLocal}
        onOpenChange={(open) => {
          if (!open) setDraft(null)
        }}
      />
      {mappingMode && repo && pendingLocal && (
        <LocalPathDialog
          key={`run:${pendingLocal.id}`}
          repoPath={repo.path}
          initialPath={mappedLocalPath ?? null}
          mode={mappingMode}
          onSaved={(localPath) => {
            const action = pendingLocal
            setPendingLocal(null)
            setMappingMode(null)
            run(action, localPath)
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
