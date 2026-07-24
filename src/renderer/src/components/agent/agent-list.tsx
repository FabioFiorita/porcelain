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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { useAddWorktree, useWorktreeInbox } from '@renderer/hooks/use-worktrees'
import { compactInputClass } from '@renderer/lib/controls'
import { openReviewSidebar } from '@renderer/lib/surface-handoffs'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import type { AgentProvider, ExternalSession, ThreadInfo } from '@shared/agent-protocol'
import { agentProviderSchema, PROVIDER_LABEL } from '@shared/agent-protocol'
import { TestIds } from '@shared/test-ids'
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  GitBranch,
  History,
  Loader2,
  PenLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type ThreadFilter = 'active' | 'archived'

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
function ThreadRow({
  thread,
  archived,
}: {
  thread: ThreadInfo
  archived: boolean
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const isActive = useTabsStore((s) => {
    const pane = s.panes[s.activePaneIndex]
    return pane?.activeTabId === tabId('agent', thread.id)
  })
  const { rename } = useRenameAgentThread()
  const { remove } = useDeleteAgentThread()
  const archive = usePreferencesStore((s) => s.archiveAgentThread)
  const unarchive = usePreferencesStore((s) => s.unarchiveAgentThread)
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

  const live = thread.status === 'working'

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              className={cn(
                'group/thread flex min-h-8 items-center gap-2 rounded-md px-2 py-1 text-sm-minus',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {live ? (
                <span
                  role="img"
                  aria-label="Live on daemon"
                  title="Running on the daemon — survives Mac sleep"
                  className="size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_3px] shadow-primary/25"
                />
              ) : (
                <ProviderGlyph provider={thread.provider} className="size-3.5 shrink-0" />
              )}
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
                  data-testid={TestIds.agentThreadRow(thread.id)}
                  data-title={thread.title}
                  className="flex min-w-0 flex-1 flex-col items-start gap-0 text-left"
                >
                  <span className="min-w-0 w-full truncate text-foreground">{thread.title}</span>
                  <span className="min-w-0 w-full truncate font-mono text-2xs text-muted-foreground">
                    {PROVIDER_LABEL[thread.provider]}
                    {thread.model ? ` · ${thread.model}` : ''}
                    {live ? ' · live' : ` · ${relativeTime(thread.updatedAt)}`}
                    {thread.worktreeBranch ? ` · ${thread.worktreeBranch}` : ''}
                  </span>
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
              {!editing && live && (
                <Loader2
                  className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                  aria-label="Working"
                />
              )}
              {!editing && !live && thread.usage !== undefined && (
                <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60">
                  {thread.usage.totalCostUsd !== undefined
                    ? formatCostUsd(thread.usage.totalCostUsd)
                    : formatTokenCount(thread.usage.turnInput)}
                </span>
              )}
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem onClick={startRename}>
            <PenLine />
            Rename
          </ContextMenuItem>
          {archived ? (
            <ContextMenuItem onClick={() => unarchive(thread.id)}>
              <ArchiveRestore />
              Unarchive
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              onClick={() => {
                archive(thread.id)
                toast.message('Archived', {
                  description: 'Hidden from Active — still on the daemon. Unarchive anytime.',
                })
              }}
            >
              <Archive />
              Archive
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2 />
            Delete permanently
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete thread?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes “{thread.title}” and its whole transcript, and stops any running turn.
              Prefer Archive if you only want it out of the list. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                unarchive(thread.id)
                remove(thread.id)
              }}
            >
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
  const addWorktree = useAddWorktree()
  const inbox = useWorktreeInbox()
  const openTab = useTabsStore((s) => s.openTab)

  // The "new thread in worktree" dialog: an Input for the branch name (no client-side
  // validation — git is the validator). `creatingWorktree` guards a double-submit while
  // `git worktree add` + thread creation + the repo switch run.
  const [worktreeOpen, setWorktreeOpen] = useState(false)
  const [worktreeName, setWorktreeName] = useState('')
  const [creatingWorktree, setCreatingWorktree] = useState(false)
  const [filter, setFilter] = useState<ThreadFilter>('active')
  const archivedIds = usePreferencesStore((s) => s.archivedAgentThreadIds)
  const archivedSet = useMemo(() => new Set(archivedIds), [archivedIds])

  // Coarse re-render tick so each row's relativeTime() label refreshes as time passes (rows
  // compute it at render, so they'd otherwise go stale). One interval for the whole list.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Two mutually exclusive segments (archive is client-local prefs):
  //   Active   = all unarchived threads (working + idle) — the roster home
  //   Archived = hidden from Active until restored
  // Idle vs working is a Session companion status (right sidebar), not a left-list
  // segment: a live-only Active left the default home empty between turns and forced
  // constant Recent clicks. Prefer Archive over Delete for finished work.
  const visibleThreads = useMemo(() => {
    const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt)
    if (filter === 'archived') return sorted.filter((t) => archivedSet.has(t.id))
    return sorted.filter((t) => !archivedSet.has(t.id))
  }, [threads, filter, archivedSet])

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

  const openWorktreeDialog = (): void => {
    setWorktreeName('')
    setWorktreeOpen(true)
  }

  const createInWorktree = async (): Promise<void> => {
    const branch = worktreeName.trim()
    if (branch === '' || creatingWorktree) return
    setCreatingWorktree(true)
    try {
      // git is the validator (dirty/collision refusals surface as a toast) — no name regex.
      const worktree = await addWorktree(branch)
      // The thread is bound to the worktree: its repoPath IS the worktree path, so it's only
      // rostered while the window is on that worktree (deliberate — see the architecture skill).
      const thread = await create({ repoPath: worktree.path, worktreeBranch: worktree.branch })
      setWorktreeOpen(false)
      setWorktreeName('')
      if (!thread) return
      // switchTo closes tabs + resets agent timelines by design; open the thread's viewer tab
      // AFTER it resolves so the fresh worktree is the active repo first (works in-place in
      // both the Electron shell and the browser client — no new-window dependency).
      await useRepoStore.getState().switchTo(worktree.path)
      openThreadTab(thread)
    } catch (error) {
      toast.error('Couldn’t create worktree', {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setCreatingWorktree(false)
    }
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
    <div data-testid={TestIds.agentList} className="flex flex-col gap-1.5">
      {/* Inbox home is Review (U15) — Agent only previews and hands off. */}
      {inbox.length > 0 && (
        <div className="px-2 pt-0.5">
          <button
            type="button"
            data-testid={TestIds.agentReviewInboxCue}
            onClick={() => openReviewSidebar()}
            className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-2xs text-foreground">
              Review inbox · {inbox.length} worktree{inbox.length === 1 ? '' : 's'}
            </span>
            <span className="size-1.5 shrink-0 rounded-full bg-info" aria-hidden />
          </button>
        </div>
      )}
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
              data-testid={TestIds.agentNewThread}
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
                    data-testid={TestIds.agentProviderMenu}
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
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-testid={TestIds.agentWorktreeMenuItem}
                  onClick={openWorktreeDialog}
                >
                  <GitBranch className="size-3.5 text-muted-foreground" />
                  <span className="flex-1">New thread in worktree…</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarHeaderActions>
      </div>
      <div className="flex items-center gap-0.5 px-2 pb-1">
        {(
          [
            ['active', 'Active'],
            ['archived', 'Archived'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-testid={TestIds.agentThreadFilter(id)}
            data-active={filter === id ? 'true' : 'false'}
            onClick={() => setFilter(id)}
            className={cn(
              'rounded-md px-2 py-1 text-2xs font-medium',
              filter === id
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-0.5 px-2">
        {threads.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-xs font-medium text-foreground">No threads yet</p>
            <p className="mx-auto mt-1 max-w-[15rem] text-xs text-muted-foreground">
              Start one with +. Threads live on the daemon — Mac sleep does not kill a remote turn.
              Prefer Archive over Delete.
            </p>
          </div>
        ) : visibleThreads.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              {filter === 'archived'
                ? 'Nothing archived. Right-click a thread → Archive.'
                : 'No active threads. Archived ones are under Archived.'}
            </p>
          </div>
        ) : (
          visibleThreads.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} archived={archivedSet.has(thread.id)} />
          ))
        )}
      </div>
      <Dialog
        open={worktreeOpen}
        onOpenChange={(next) => {
          setWorktreeOpen(next)
          if (!next) setWorktreeName('')
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New thread in worktree</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={worktreeName}
            onChange={(e) => setWorktreeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                createInWorktree()
              }
            }}
            placeholder="Branch name"
            aria-label="Branch name"
            data-testid={TestIds.agentWorktreeBranch}
            className="rounded-md font-mono"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWorktreeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={worktreeName.trim() === '' || creatingWorktree}
              data-testid={TestIds.agentWorktreeCreate}
              onClick={createInWorktree}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
