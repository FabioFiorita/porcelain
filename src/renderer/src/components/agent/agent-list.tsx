import { formatCostUsd, formatTokenCount } from '@renderer/components/agent/agents-quick-access'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Input } from '@renderer/components/ui/input'
import {
  useAgentProviders,
  useAgentThreads,
  useCreateAgentThread,
  useDeleteAgentThread,
  useExternalAgentSessions,
  useImportAgentSession,
  useRenameAgentThread,
} from '@renderer/hooks/use-agents'
import { compactInputClass } from '@renderer/lib/controls'
import { cn } from '@renderer/lib/utils'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import type { AgentProvider, ExternalSession, ThreadInfo } from '@shared/agent-protocol'
import { agentProviderSchema, PROVIDER_LABEL } from '@shared/agent-protocol'
import { ChevronDown, History, Loader2, PenLine, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

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
                'group/thread flex h-7 items-center gap-2 rounded-md px-2 text-sm-minus',
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
                  className={cn(
                    compactInputClass,
                    'min-w-0 flex-1 border-input/50 bg-input/30 px-1.5',
                  )}
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
                  // Prefer a spend/token chip over relative time when the thread has usage
                  // so expensive threads are obvious without opening them.
                  <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60 group-hover/thread:hidden">
                    {thread.usage?.totalCostUsd !== undefined
                      ? formatCostUsd(thread.usage.totalCostUsd)
                      : thread.usage !== undefined
                        ? formatTokenCount(thread.usage.turnInput)
                        : relativeTime(thread.updatedAt)}
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
 * The Agent sidebar tab body: the roster of agent threads for the current repo. The split
 * "+" starts a new thread on the last-used provider and opens it, while its dropdown starts
 * one on a specific provider (uninstalled ones disabled); a row opens/focuses its viewer tab.
 * Mirrors the Terminal/Board tabs — a list here, the live surface (timeline + composer) in
 * the viewer. Sessions are daemon-owned, so a thread persists across reloads.
 */
export function AgentList(): React.JSX.Element {
  const threads = useAgentThreads()
  const providers = useAgentProviders()
  const external = useExternalAgentSessions()
  const { create, isPending } = useCreateAgentThread()
  const { importSession, isPending: isImporting } = useImportAgentSession()
  const openTab = useTabsStore((s) => s.openTab)

  // Coarse re-render tick so each row's relativeTime() label refreshes as time passes (rows
  // compute it at render, so they'd otherwise go stale). One interval for the whole list.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const openThreadTab = (thread: ThreadInfo): void => {
    openTab({ id: tabId('agent', thread.id), kind: 'agent', title: thread.title, path: thread.id })
  }

  const newThread = async (): Promise<void> => {
    // Nothing supplied = resume the last-used provider with its remembered config (model,
    // access mode, options, Build/Plan); falls back to the driver's default on a fresh config.
    const thread = await create({})
    if (thread) openThreadTab(thread)
  }

  const newThreadWith = async (provider: AgentProvider): Promise<void> => {
    // An explicit provider pick inherits THAT provider's remembered defaults (the daemon
    // resolves model/mode/options/interaction per provider — no cross-provider mix).
    const thread = await create({ provider })
    if (thread) openThreadTab(thread)
  }

  const openExternal = async (session: ExternalSession): Promise<void> => {
    // Already imported → just focus the existing thread tab.
    if (session.threadId) {
      const existing = threads.find((t) => t.id === session.threadId)
      openThreadTab(
        existing ?? {
          id: session.threadId,
          repoPath: '',
          title: session.title,
          provider: session.provider,
          model: session.model ?? '',
          mode: 'full',
          status: 'idle',
          createdAt: session.updatedAt,
          updatedAt: session.updatedAt,
        },
      )
      return
    }
    try {
      const thread = await importSession(session.provider, session.externalId)
      if (thread) openThreadTab(thread)
    } catch {
      toast.error('Couldn’t open that session')
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-end px-2">
        <SidebarHeaderActions>
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Open recent CLI session"
                    disabled={isImporting}
                  >
                    {isImporting ? <Loader2 className="animate-spin" /> : <History />}
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-64 max-w-80">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Open recent session…</DropdownMenuLabel>
                  {external.length === 0 ? (
                    <div className="px-2 py-3 text-2xs text-muted-foreground">
                      No CLI sessions found for this repo. Run Grok, Claude, Codex, or OpenCode here
                      first.
                    </div>
                  ) : (
                    external.map((session) => (
                      <DropdownMenuItem
                        key={`${session.provider}:${session.externalId}`}
                        onClick={() => openExternal(session)}
                        className="items-start gap-2 py-1.5"
                      >
                        <ProviderGlyph
                          provider={session.provider}
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm-minus">{session.title}</span>
                          <span className="block text-2xs text-muted-foreground">
                            {PROVIDER_LABEL[session.provider]}
                            {' · '}
                            {relativeTime(session.updatedAt)}
                            {session.threadId ? ' · open' : ''}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={newThread}
              aria-label="New thread"
              disabled={isPending}
            >
              <Plus />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-ml-1.5 size-5"
                    aria-label="Choose provider for new thread"
                    disabled={isPending}
                  >
                    <ChevronDown />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-44">
                {/* Base UI requires GroupLabel inside a Group (Radix did not) */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>New thread with…</DropdownMenuLabel>
                  {agentProviderSchema.options.map((provider) => {
                    // Treat "not yet probed" as available so a slow probe doesn't lock the menu;
                    // only hard-disable once we KNOW the CLI is missing (mirrors the composer).
                    const installed =
                      providers.find((p) => p.provider === provider)?.installed ?? true
                    return (
                      <DropdownMenuItem
                        key={provider}
                        disabled={!installed}
                        onClick={() => newThreadWith(provider)}
                      >
                        <ProviderGlyph
                          provider={provider}
                          className="size-3.5 text-muted-foreground"
                        />
                        <span className="flex-1">{PROVIDER_LABEL[provider]}</span>
                        {!installed && (
                          <span className="text-2xs text-muted-foreground/60">Not installed</span>
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarHeaderActions>
      </div>
      <div className="flex flex-col gap-0.5 px-2">
        {threads.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs-minus text-muted-foreground/60">
            No threads yet. Start one with +, or open a recent CLI session.
          </p>
        ) : (
          threads.map((thread) => <ThreadRow key={thread.id} thread={thread} />)
        )}
      </div>
    </div>
  )
}
