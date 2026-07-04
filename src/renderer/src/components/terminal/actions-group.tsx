import type { Action } from '@backend/actions-store'
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
import { ArrowDown, ArrowUp, MoreHorizontal, PenLine, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ActionComposer, type ActionDraft, draftFromAction } from './action-composer'

function ActionRow({
  action,
  onEdit,
  isFirst,
  isLast,
}: {
  action: Action
  onEdit: (action: Action) => void
  isFirst: boolean
  isLast: boolean
}): React.JSX.Element {
  const run = useRunAction()
  const { move, remove } = useActionMutations()
  return (
    <div className="group/action glaze-tile flex items-center gap-1 p-2 [--tile-fill:var(--surface-2)]">
      <button
        type="button"
        onClick={() => run(action)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        // The full command is always visible before it runs — an agent can author
        // actions, so the human must see exactly what a click executes (see audit skill).
        title={`Run: ${action.command}`}
      >
        <Play className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{action.title}</span>
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
              className="size-5 shrink-0 opacity-0 group-hover/action:opacity-100"
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
 * over MCP; the human runs them. Mirrors the Comments/Board sections.
 */
export function ActionsGroup(): React.JSX.Element {
  const actions = useActions()
  const [draft, setDraft] = useState<ActionDraft | null>(null)

  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="flex items-center justify-between px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Saved commands
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-5"
          aria-label="Add action"
          onClick={() => setDraft({ title: '', command: '', cwd: '' })}
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
              isFirst={index === 0}
              isLast={index === actions.length - 1}
            />
          ))
        )}
      </SidebarGroupContent>
      <ActionComposer
        draft={draft}
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null)
        }}
      />
    </SidebarGroup>
  )
}
