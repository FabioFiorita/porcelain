import type { FileStatus, FlowFile } from '@porcelain/contracts/git'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@renderer/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  type DiffReadingScope,
  useBranchFlow,
  useDiffFileHoverPrefetch,
  useDiscardFile,
  useFileStaging,
  useGitFlow,
  useReviewedPaths,
  useToggleReviewed,
} from '@renderer/features/git'
import { toastingAction } from '@renderer/hooks/mutation-error'
import { dirName, fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { useHubTarget } from '@renderer/stores/hub-selection'
import { targetedTab } from '@renderer/stores/hub-tabs'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useRevealStore } from '@renderer/stores/reveal'
import { useActiveTab, useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import {
  Check,
  FileText,
  MessageSquarePlus,
  Minus,
  Plus,
  Rows3,
  Square,
  SquareCheck,
  Undo2,
} from 'lucide-react'
import { memo, useState } from 'react'
import { ChangesBasePicker } from './changes-base-picker'
import { ChangesEmptyState } from './changes-empty-state'
import { ChangesScopeToggle } from './changes-scope-toggle'
import { changesetTabKey } from './changeset-tab-key'
import { type CommentAnchor, CommentComposer } from './comment-composer'
import { CommentsManageMenu } from './comments-manage-menu'
import { DiscardFileDialog } from './discard-file-dialog'
import { FileCommentButton } from './file-comment-button'
import { ReviewAllToggle } from './review-all-toggle'

const statusBadge: Record<FileStatus, { label: string; className: string }> = {
  modified: { label: 'M', className: 'text-warning' },
  added: { label: 'A', className: 'text-success' },
  deleted: { label: 'D', className: 'text-destructive' },
  renamed: { label: 'R', className: 'text-info' },
  untracked: { label: 'U', className: 'text-success' },
}

function FileRowImpl({
  file,
  repoPath,
  base,
}: {
  file: FlowFile
  repoPath: string
  base: string | undefined
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const reveal = useRevealStore((s) => s.reveal)
  const prefetchDiff = useDiffFileHoverPrefetch()
  const { stageFile, unstageFile } = useFileStaging()
  const discardFile = useDiscardFile()
  const reviewed = useReviewedPaths()
  const { mark, unmark } = useToggleReviewed()
  const isReviewed = reviewed.has(file.path)
  // The row is "open" when the Viewer shows this file's diff in the same scope:
  // a working-tree row (no base) must not light up for a branch-diff tab, and a
  // diff tab bound to another Worktree must not light up this project's row (tab
  // paths are repository-relative, so two projects share them).
  const activeTab = useActiveTab()
  const hubTarget = useHubTarget()
  const isOpen =
    activeTab?.kind === 'diff' &&
    activeTab.path === file.path &&
    activeTab.base === base &&
    (activeTab.target === undefined || activeTab.target.path === hubTarget?.path)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)
  const confirmDiscardFile = toastingAction('Discard file', () => discardFile(file.path))
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const name = fileName(file.path)
  const connects = file.connects.map((c) => fileName(c)).join(', ')
  // A new file (no committed version) is trashed rather than reverted; word the
  // confirmation to match what discard actually does in each case.
  const isNew = file.status === 'untracked' || file.status === 'added'

  // The row's click opens the working-tree diff; this opens the FULL file (better
  // for reading it whole), flips the sidebar to Files, and reveals the file in
  // the tree (expand down to it + scroll + highlight). Like review-list, the
  // file tab is keyed by the absolute path.
  const handleOpenFile = (): void => {
    const absolute = `${repoPath}/${file.path}`
    openTab(targetedTab('file', absolute, { title: name }))
    setSidebarTab('files')
    reveal(absolute)
  }

  return (
    <SidebarMenuItem>
      <ContextMenu>
        {/* The whole row IS the trigger, so right-click anywhere on it opens the
            menu and left-click opens the diff. The status letter leads the row
            (left), next to the name, rather than floating in a detached badge. */}
        <div className="relative">
          <ContextMenuTrigger
            render={
              <SidebarMenuButton
                className="h-auto py-1 pr-8"
                isActive={isOpen}
                data-testid={TestIds.changesFile(name)}
                data-path={file.path}
                data-reviewed={isReviewed}
                onClick={() =>
                  openTab(
                    targetedTab('diff', file.path, {
                      title: name,
                      key: base ? `${base}:${file.path}` : file.path,
                      base,
                    }),
                  )
                }
                onMouseEnter={() => prefetchDiff(file.path, base)}
              />
            }
          >
            <div className="flex min-w-0 items-start gap-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      role="img"
                      aria-label={file.status}
                      className={cn(
                        'mt-px w-3 shrink-0 text-center font-mono text-xs font-semibold',
                        statusBadge[file.status].className,
                      )}
                    >
                      {statusBadge[file.status].label}
                    </span>
                  }
                />
                <TooltipContent>{file.status}</TooltipContent>
              </Tooltip>
              <div className="flex min-w-0 flex-col items-start">
                <span className="flex max-w-full items-baseline gap-1.5">
                  {file.staged && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span
                            role="img"
                            aria-label={file.unstaged ? 'Partially staged' : 'Staged'}
                            className={cn(
                              'size-1.5 shrink-0 self-center rounded-full',
                              file.unstaged ? 'bg-warning' : 'bg-success',
                            )}
                          />
                        }
                      />
                      <TooltipContent>
                        {file.unstaged ? 'Partially staged' : 'Staged'}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <span
                    className={cn(
                      'truncate font-mono text-sm-minus',
                      isReviewed && 'text-muted-foreground',
                    )}
                  >
                    {name}
                  </span>
                  {file.additions !== undefined && (
                    <span className="shrink-0 font-mono text-2xs text-success">
                      +{file.additions}
                    </span>
                  )}
                  {file.deletions !== undefined && (
                    <span className="shrink-0 font-mono text-2xs text-destructive">
                      −{file.deletions}
                    </span>
                  )}
                  {/* Reviewed mark: the row's right edge belongs to the comment
                      button, so the check rides the name line instead. */}
                  {isReviewed && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Check
                            role="img"
                            aria-label="Reviewed"
                            className="size-3 shrink-0 self-center text-success"
                          />
                        }
                      />
                      <TooltipContent>Reviewed</TooltipContent>
                    </Tooltip>
                  )}
                </span>
                <span
                  className="max-w-full truncate font-mono text-xs text-muted-foreground"
                  dir="rtl"
                >
                  {dirName(file.path)}
                </span>
                {connects && (
                  <span className="max-w-full truncate font-mono text-xs text-muted-foreground/70">
                    → {connects}
                  </span>
                )}
              </div>
            </div>
          </ContextMenuTrigger>
        </div>
        <FileCommentButton path={file.path} />
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => {
              if (isReviewed) unmark(file.path)
              else mark(file.path)
            }}
          >
            {isReviewed ? <Square /> : <SquareCheck />}
            {isReviewed ? 'Unmark reviewed' : 'Mark reviewed'}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setCommentAnchor({ path: file.path })}>
            <MessageSquarePlus />
            Comment on file
          </ContextMenuItem>
          {/* Deleted files no longer exist on disk, so opening them would error. */}
          {file.status !== 'deleted' && (
            <ContextMenuItem onClick={handleOpenFile}>
              <FileText />
              Open file
            </ContextMenuItem>
          )}
          {file.unstaged && (
            <ContextMenuItem onClick={toastingAction('Stage file', () => stageFile(file.path))}>
              <Plus />
              Stage
            </ContextMenuItem>
          )}
          {file.staged && (
            <ContextMenuItem onClick={toastingAction('Unstage file', () => unstageFile(file.path))}>
              <Minus />
              Unstage
            </ContextMenuItem>
          )}
          {/* Discard only makes sense against the working tree — hidden in the
              branch-diff scope, where rows are committed changes vs a base. */}
          {!base && (
            <ContextMenuItem variant="destructive" onClick={() => setConfirmDiscard(true)}>
              <Undo2 />
              Discard changes
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <DiscardFileDialog
        name={name}
        isNew={isNew}
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        onConfirm={confirmDiscardFile}
      />
      <CommentComposer
        anchor={commentAnchor}
        open={commentAnchor !== null}
        onOpenChange={(open: boolean): void => {
          if (!open) setCommentAnchor(null)
        }}
      />
    </SidebarMenuItem>
  )
}

const FileRow = memo(FileRowImpl)

export function ChangesList(): React.JSX.Element {
  const project = useProjectSelectionStore((s) => s.project)
  const changesScope = usePreferencesStore((s) => s.changesScope)
  const openTab = useTabsStore((s) => s.openTab)

  // Always call both hooks — hooks can't be conditional. Branch hook is disabled
  // when scope is 'working' (no wasted fetch); working hook always fetches (it
  // polls for live working-tree state regardless of the active scope).
  const working = useGitFlow()
  // The stored pick is per repo path — "compare against develop" is a fact about
  // one project, not a global mode.
  const requestedBase = usePreferencesStore((s) =>
    project ? s.compareBases[project.path] : undefined,
  )
  const setCompareBase = usePreferencesStore((s) => s.setCompareBase)
  const branch = useBranchFlow(changesScope === 'branch', requestedBase)

  // Polls live (gitFlow / branch flow) — no manual refresh control.
  const { groups } = changesScope === 'branch' ? branch : working
  const base = changesScope === 'branch' ? branch.base : undefined
  const reviewed = useReviewedPaths()

  if (!project || groups === undefined) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  const total = groups.reduce((n, g) => n + g.files.length, 0)
  const paths = groups.flatMap((group) => group.files.map((file) => file.path))
  const allReviewed = total > 0 && paths.every((path) => reviewed.has(path))
  // Opens the continuous stacked-diff surface for the active scope (working or
  // branch) — same flow order as this list, one scrollable document.
  const handleOpenReviewAll = (): void => {
    // Carry the SAME base into the stacked-diff surface. Without it the list would
    // say "12 files vs develop" and Review All would show the diff vs origin/main.
    const scope: DiffReadingScope =
      changesScope === 'branch'
        ? { type: 'branch', ...(base === undefined ? {} : { base }) }
        : { type: 'working' }
    const key = changesetTabKey(scope)
    openTab(
      targetedTab('changeset', key, {
        title: scope.type === 'branch' ? `All changes · vs ${base ?? 'base'}` : 'All changes',
      }),
    )
  }

  return (
    <div data-testid={TestIds.changesList} className="flex flex-col gap-2 p-2">
      <ChangesScopeToggle />
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-0.5">
          <span
            data-testid={TestIds.changesSummary}
            data-count={total}
            className="min-w-0 truncate text-xs text-muted-foreground"
          >
            {total} changed {total === 1 ? 'file' : 'files'}
            {base !== undefined && ' ·'}
          </span>
          {base !== undefined && (
            <ChangesBasePicker
              repoPath={project.path}
              selected={base}
              defaultBase={branch.defaultBase}
              requested={requestedBase}
              onSelect={(next) => setCompareBase(project.path, next)}
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <CommentsManageMenu />
          {total > 0 && <ReviewAllToggle paths={paths} allReviewed={allReviewed} />}
          {total > 0 && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0"
                    onClick={handleOpenReviewAll}
                    aria-label="All changes"
                  >
                    <Rows3 className="size-3" />
                  </Button>
                }
              />
              <TooltipContent>All changes</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      {total === 0 ? (
        <ChangesEmptyState />
      ) : (
        groups.map((group) => (
          <div key={group.layer}>
            <SidebarGroupLabel className="h-6 px-0 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {group.layer}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.files.map((file) => (
                <FileRow key={file.path} file={file} repoPath={project.path} base={base} />
              ))}
            </SidebarMenu>
          </div>
        ))
      )}
    </div>
  )
}
