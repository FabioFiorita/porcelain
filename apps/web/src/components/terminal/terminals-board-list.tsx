import type { TerminalInfo } from '@porcelain/contracts/terminal'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { ENVIRONMENT_GROUP_KEY, type EnvironmentTerminals } from '@renderer/features/terminal'
import { toastingAction } from '@renderer/hooks/mutation-error'
import { cn } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { Layers, Monitor, PenLine, SquareTerminal, X } from 'lucide-react'

/**
 * Shells the Environment row can start. Fixed literal names, not the Environment nickname:
 * these are found again BY name on the next visit, and a nickname is display text the human
 * can change at any time. `initialInput` is a create-time field, so a multiplexer shortcut
 * is a spawn, never a write into an existing shell.
 */
export const ENVIRONMENT_SHELLS = [
  { key: 'herdr', label: 'herdr', name: 'herdr', initialInput: 'herdr\n' },
  { key: 'tmux', label: 'tmux', name: 'tmux', initialInput: 'tmux new -A -s porcelain\n' },
] as const

export type TerminalRowHandlers = Readonly<{
  focusedId: string | null
  localIds: ReadonlySet<string>
  onFocus: (id: string) => void
  onClose: (id: string) => void
  onRename: (session: { id: string; name: string }) => void
  onOpenShell: (
    environment: EnvironmentTerminals,
    shell: (typeof ENVIRONMENT_SHELLS)[number],
  ) => void
}>

function SessionRow({
  session,
  handlers,
}: {
  session: TerminalInfo
  handlers: TerminalRowHandlers
}): React.JSX.Element {
  const isLocal = handlers.localIds.has(session.id)
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            className={cn(
              'group/term flex h-7 w-full min-w-0 items-center gap-2 rounded-md pr-1 pl-2 text-xs',
              session.id === handlers.focusedId
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50',
            )}
          >
            <button
              type="button"
              data-testid={TestIds.terminalsBoardSession(session.id)}
              aria-current={session.id === handlers.focusedId ? 'true' : undefined}
              title={isLocal ? `${session.name} — this device` : session.name}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => handlers.onFocus(session.id)}
              onDoubleClick={() => handlers.onRename({ id: session.id, name: session.name })}
            >
              {isLocal ? (
                <Monitor className="size-3.5 shrink-0" />
              ) : (
                <SquareTerminal className="size-3.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{session.name}</span>
              {session.status === 'exited' && <span className="shrink-0">exited</span>}
            </button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5 shrink-0 opacity-0 group-hover/term:opacity-100 [@media(hover:none)]:opacity-100"
              aria-label={`Close ${session.name}`}
              data-testid={TestIds.terminalsBoardClose(session.id)}
              onClick={() => handlers.onClose(session.id)}
            >
              <X />
            </Button>
          </div>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem onClick={() => handlers.onRename({ id: session.id, name: session.name })}>
          <PenLine />
          Rename
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * One Environment's shells: the machine itself first — present even with nothing running,
 * because the multiplexer shortcuts are how a herd gets started — then its Projects.
 *
 * The Environment heading is not decoration. Two machines can hold checkouts with the same
 * project name, and this is the line that says which host a shell is actually on.
 */
export function EnvironmentTerminalsSection({
  environment,
  handlers,
}: {
  environment: EnvironmentTerminals
  handlers: TerminalRowHandlers
}): React.JSX.Element {
  const environmentSessions =
    environment.groups.find((group) => group.key === ENVIRONMENT_GROUP_KEY)?.sessions ?? []
  return (
    <div
      data-testid={TestIds.terminalsBoardEnvironmentSection(environment.environmentId ?? 'current')}
    >
      <div className="pb-2" data-testid={TestIds.terminalsBoardGroup(ENVIRONMENT_GROUP_KEY)}>
        <div className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground">
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {environment.name}
          </span>
          {ENVIRONMENT_SHELLS.map((shell) => (
            <Button
              key={shell.key}
              variant="ghost"
              size="sm"
              className="h-5 shrink-0 gap-1 px-1.5 text-2xs"
              disabled={environment.root === null}
              data-testid={TestIds.terminalsBoardEnvironmentShell(shell.key)}
              title={`Open ${shell.label} on ${environment.name}`}
              onClick={toastingAction(`Open ${shell.label}`, async () =>
                handlers.onOpenShell(environment, shell),
              )}
            >
              <Layers className="size-3" />
              {shell.label}
            </Button>
          ))}
        </div>
        {environmentSessions.map((session) => (
          <SessionRow key={session.id} session={session} handlers={handlers} />
        ))}
      </div>
      {environment.groups
        .filter((group) => group.key !== ENVIRONMENT_GROUP_KEY)
        .map((group) => (
          <div
            key={group.key}
            className="pb-2"
            data-testid={TestIds.terminalsBoardGroup(group.key)}
          >
            <div className="px-2 py-1 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{group.label}</span>
              {group.worktreeName !== null && <span> · {group.worktreeName}</span>}
            </div>
            {group.sessions.map((session) => (
              <SessionRow key={session.id} session={session} handlers={handlers} />
            ))}
          </div>
        ))}
    </div>
  )
}
