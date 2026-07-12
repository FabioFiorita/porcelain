import { ProviderGlyph } from '@renderer/components/agent/provider-glyph'
import { SidebarHeaderActions } from '@renderer/components/shell/sidebar-header-actions'
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Input } from '@renderer/components/ui/input'
import {
  useAgentThreads,
  useCreateAgentThread,
  useDeleteAgentThread,
  useRenameAgentThread,
} from '@renderer/hooks/use-agents'
import { cn } from '@renderer/lib/utils'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import type { ThreadInfo } from '@shared/agent-protocol'
import { Loader2, PenLine, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

/** Short "updated" label for a thread row — coarse buckets, never a live-ticking string. */
function relativeTime(ms: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (seconds < 60) return 'now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`
  return `${Math.round(days / 7)}w`
}

/**
 * One thread row — the Agent sibling of a Terminal-list row (same glass hover/selected
 * fills, same hover-revealed trailing action + context menu). Double-click or the menu's
 * Rename swaps the title for an inline input; Delete confirms through an AlertDialog
 * (a thread's transcript isn't recoverable, unlike a trashed file).
 */
function ThreadRow({ thread }: { thread: ThreadInfo }): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const isActive = useTabsStore((s) => {
    const pane = s.panes[s.activePaneIndex]
    return pane?.activeTabId === tabId('agent', thread.id)
  })
  const { rename } = useRenameAgentThread()
  const { remove } = useDeleteAgentThread()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(thread.title)
  const [confirming, setConfirming] = useState(false)

  const open = (): void => {
    openTab({ id: tabId('agent', thread.id), kind: 'agent', title: thread.title, path: thread.id })
  }

  const startRename = (): void => {
    setDraft(thread.title)
    setEditing(true)
  }

  const commitRename = async (): Promise<void> => {
    setEditing(false)
    if (draft.trim() !== '' && draft.trim() !== thread.title) await rename(thread.id, draft)
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              className={cn(
                'group/thread flex h-8 items-center gap-2 rounded-md px-2 text-sm-minus',
                isActive
                  ? 'bg-(--selected-fill) text-foreground'
                  : 'text-muted-foreground hover:bg-(--hover-fill)',
              )}
            >
              <ProviderGlyph provider={thread.provider} className="size-3.5" />
              {editing ? (
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={commitRename}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      await commitRename()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setEditing(false)
                    }
                  }}
                  className="h-6 min-w-0 flex-1 rounded-sm border-input/50 bg-input/30 px-1.5 text-sm-minus"
                  aria-label="Thread name"
                />
              ) : (
                <button
                  type="button"
                  onClick={open}
                  onDoubleClick={startRename}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                </button>
              )}
              {!editing && thread.status !== 'working' && thread.lastTurnFailed && (
                <span
                  role="img"
                  aria-label="Last turn failed"
                  title="Last turn ended with an error"
                  className="size-1.5 shrink-0 rounded-full bg-destructive"
                />
              )}
              {!editing &&
                (thread.status === 'working' ? (
                  <Loader2
                    className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                    aria-label="Working"
                  />
                ) : (
                  <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60 group-hover/thread:hidden">
                    {relativeTime(thread.updatedAt)}
                  </span>
                ))}
              <Button
                variant="ghost"
                size="icon-sm"
                className="hidden size-5 shrink-0 group-hover/thread:flex hover:text-destructive [@media(hover:none)]:flex"
                aria-label={`Delete ${thread.title}`}
                onClick={() => setConfirming(true)}
              >
                <Trash2 />
              </Button>
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem onClick={startRename}>
            <PenLine />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2 />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete thread?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes “{thread.title}” and its whole transcript, and stops any running turn.
              This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove(thread.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * The Agent sidebar tab body: the roster of agent threads for the current repo. "+"
 * starts a new Claude thread and opens it; a row opens/focuses its viewer tab. Mirrors
 * the Terminal/Board tabs — a list here, the live surface (timeline + composer) in the
 * viewer. Sessions are daemon-owned, so a thread persists across reloads.
 */
export function AgentList(): React.JSX.Element {
  const threads = useAgentThreads()
  const { create, isPending } = useCreateAgentThread()
  const openTab = useTabsStore((s) => s.openTab)

  const newThread = async (): Promise<void> => {
    // No provider/model = default to the last-used selection (the composer's model
    // picker changes it later); falls back to the driver's default on a fresh config.
    const thread = await create({ mode: 'full' })
    if (thread) {
      openTab({
        id: tabId('agent', thread.id),
        kind: 'agent',
        title: thread.title,
        path: thread.id,
      })
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-end px-2">
        <SidebarHeaderActions>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={newThread}
            aria-label="New thread"
            disabled={isPending}
          >
            <Plus />
          </Button>
        </SidebarHeaderActions>
      </div>
      <div className="flex flex-col gap-0.5 px-2">
        {threads.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs-minus text-muted-foreground/60">
            No threads yet. Start one with +.
          </p>
        ) : (
          threads.map((thread) => <ThreadRow key={thread.id} thread={thread} />)
        )}
      </div>
    </div>
  )
}
