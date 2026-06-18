import type { FileStatus } from '@main/diff'
import type { FlowFile } from '@main/flow'
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
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@renderer/components/ui/sidebar'
import { useBranchFlow } from '@renderer/hooks/use-branch-flow'
import { useDiscardFile, useFileStaging } from '@renderer/hooks/use-commit'
import { useDiffFilePrefetch } from '@renderer/hooks/use-diff'
import { useGitFlow } from '@renderer/hooks/use-git-flow'
import { useReviewedPaths, useToggleReviewed } from '@renderer/hooks/use-reviewed'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useRevealStore } from '@renderer/stores/reveal'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { Check, FileText, Minus, Plus, RefreshCw, Square, SquareCheck, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { ChangesScopeToggle } from './changes-scope-toggle'

const statusBadge: Record<FileStatus, { label: string; className: string }> = {
  modified: { label: 'M', className: 'text-warning' },
  added: { label: 'A', className: 'text-success' },
  deleted: { label: 'D', className: 'text-destructive' },
  renamed: { label: 'R', className: 'text-info' },
  untracked: { label: 'U', className: 'text-success' },
}

function FileRow({
  file,
  repoPath,
  isReviewed,
  base,
}: {
  file: FlowFile
  repoPath: string
  isReviewed: boolean
  base: string | undefined
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const reveal = useRevealStore((s) => s.reveal)
  const prefetchDiff = useDiffFilePrefetch()
  const { stageFile, unstageFile } = useFileStaging()
  const discardFile = useDiscardFile()
  const { mark, unmark } = useToggleReviewed()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const name = file.path.split('/').at(-1) ?? file.path
  const connects = file.connects.map((c) => c.split('/').at(-1)).join(', ')
  // A new file (no committed version) is trashed rather than reverted; word the
  // confirmation to match what discard actually does in each case.
  const isNew = file.status === 'untracked' || file.status === 'added'

  // The row's click opens the working-tree diff; this opens the FULL file (better
  // for reading it whole), flips the sidebar to Files, and reveals the file in
  // the tree (expand down to it + scroll + highlight). Like feature-list, the
  // file tab is keyed by the absolute path.
  const openFile = (): void => {
    const absolute = `${repoPath}/${file.path}`
    openTab({ id: tabId('file', absolute), kind: 'file', title: name, path: absolute })
    setSidebarTab('files')
    reveal(absolute)
  }

  return (
    <SidebarMenuItem>
      <ContextMenu>
        {/* The whole row IS the trigger, so right-click anywhere on it opens the
            menu and left-click opens the diff. The status letter leads the row
            (left), next to the name, rather than floating in a detached badge. */}
        <ContextMenuTrigger
          render={
            <SidebarMenuButton
              className="h-auto py-1"
              onClick={() =>
                openTab({
                  id: tabId('diff', base ? `${base}:${file.path}` : file.path),
                  kind: 'diff',
                  title: name,
                  path: file.path,
                  ...(base ? { base } : {}),
                })
              }
              onMouseEnter={() => prefetchDiff(file.path, base)}
            />
          }
        >
          <div className="flex min-w-0 items-start gap-2">
            <span
              className={cn(
                'mt-px w-3 shrink-0 text-center font-mono text-xs font-semibold',
                statusBadge[file.status].className,
              )}
              title={file.status}
            >
              {statusBadge[file.status].label}
            </span>
            <div className="flex min-w-0 flex-col items-start">
              <span className="flex max-w-full items-baseline gap-1.5">
                {file.staged && (
                  <span
                    className={cn(
                      'size-1.5 shrink-0 self-center rounded-full',
                      file.unstaged ? 'bg-warning' : 'bg-success',
                    )}
                    title={file.unstaged ? 'Partially staged' : 'Staged'}
                  />
                )}
                {isReviewed && (
                  <Check
                    className="size-3 shrink-0 self-center text-success"
                    aria-label="Reviewed"
                  />
                )}
                <span
                  className={cn(
                    'truncate text-[13px]',
                    isReviewed && 'text-muted-foreground line-through',
                  )}
                >
                  {name}
                </span>
                {file.additions !== undefined && (
                  <span className="shrink-0 font-mono text-[10px] text-success">
                    +{file.additions}
                  </span>
                )}
                {file.deletions !== undefined && (
                  <span className="shrink-0 font-mono text-[10px] text-destructive">
                    −{file.deletions}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate text-xs text-muted-foreground" dir="rtl">
                {file.path.split('/').slice(0, -1).join('/')}
              </span>
              {connects && (
                <span className="max-w-full truncate text-xs text-muted-foreground/70">
                  → {connects}
                </span>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {isReviewed ? (
            <ContextMenuItem onClick={async () => unmark(file.path)}>
              <Square />
              Unmark reviewed
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={async () => mark(file.path)}>
              <SquareCheck />
              Mark reviewed
            </ContextMenuItem>
          )}
          {/* Deleted files no longer exist on disk, so opening them would error. */}
          {file.status !== 'deleted' && (
            <ContextMenuItem onClick={openFile}>
              <FileText />
              Open file
            </ContextMenuItem>
          )}
          {file.unstaged && (
            <ContextMenuItem onClick={() => stageFile(file.path)}>
              <Plus />
              Stage
            </ContextMenuItem>
          )}
          {file.staged && (
            <ContextMenuItem onClick={() => unstageFile(file.path)}>
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
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isNew
                ? `This moves the new file “${name}” to the Trash — you can restore it from there.`
                : `This reverts “${name}” to the last commit. Uncommitted changes cannot be recovered.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => discardFile(file.path)}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenuItem>
  )
}

export function ChangesList(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const changesScope = usePreferencesStore((s) => s.changesScope)

  // Always call both hooks — hooks can't be conditional. Branch hook is disabled
  // when scope is 'working' (no wasted fetch); working hook always fetches (it
  // polls for live working-tree state regardless of the active scope).
  const working = useGitFlow()
  const branch = useBranchFlow(changesScope === 'branch')

  const { groups, refresh } = changesScope === 'branch' ? branch : working
  const base = changesScope === 'branch' ? branch.base : undefined

  const reviewed = useReviewedPaths()

  if (!repo || groups === undefined) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  const total = groups.reduce((n, g) => n + g.files.length, 0)
  const reviewedCount = groups.reduce(
    (n, g) => n + g.files.filter((f) => reviewed.has(f.path)).length,
    0,
  )

  return (
    <div className="flex flex-col gap-1">
      {/* Two rows so a long "N changed files · vs base · N reviewed" line and the
          Working/Branch picker never fight for width in the narrow panel. */}
      <div className="flex flex-col gap-1 px-2">
        <div className="flex items-start justify-between gap-1">
          {total > 0 && reviewedCount === total ? (
            // Completion moment: the whole change set has been reviewed — the
            // story is read end to end, so the count gives way to a clear signal.
            <span className="flex min-w-0 items-start gap-1 text-xs text-success">
              <Check className="mt-0.5 size-3 shrink-0" />
              All {total} {total === 1 ? 'file' : 'files'} reviewed{base && ` · vs ${base}`}
            </span>
          ) : (
            <span className="min-w-0 text-xs text-muted-foreground">
              {total} changed {total === 1 ? 'file' : 'files'}
              {base && ` · vs ${base}`}
              {reviewedCount > 0 && ` · ${reviewedCount} reviewed`}
            </span>
          )}
          <SidebarHeaderActions>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onClick={refresh}
              aria-label="Refresh changes"
            >
              <RefreshCw />
            </Button>
          </SidebarHeaderActions>
        </div>
        <ChangesScopeToggle />
      </div>
      {total === 0 ? (
        <p className="px-3 py-2 text-[13px] text-muted-foreground">
          No changes to review — your working tree is clean.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.layer}>
            <SidebarGroupLabel className="h-6 px-2 text-[10px] uppercase tracking-wider">
              {group.layer}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.files.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  repoPath={repo.path}
                  isReviewed={reviewed.has(file.path)}
                  base={base}
                />
              ))}
            </SidebarMenu>
          </div>
        ))
      )}
    </div>
  )
}
