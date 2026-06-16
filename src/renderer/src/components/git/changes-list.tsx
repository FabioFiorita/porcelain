import type { FileStatus } from '@main/diff'
import type { FlowFile } from '@main/flow'
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@renderer/components/ui/sidebar'
import { useFileStaging } from '@renderer/hooks/use-commit'
import { useDiffFilePrefetch } from '@renderer/hooks/use-diff'
import { useGitFlow } from '@renderer/hooks/use-git-flow'
import { useReviewedPaths, useToggleReviewed } from '@renderer/hooks/use-reviewed'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useRevealStore } from '@renderer/stores/reveal'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { Check, RefreshCw } from 'lucide-react'

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
}: {
  file: FlowFile
  repoPath: string
  isReviewed: boolean
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const reveal = useRevealStore((s) => s.reveal)
  const prefetchDiff = useDiffFilePrefetch()
  const { stageFile, unstageFile } = useFileStaging()
  const { mark, unmark } = useToggleReviewed()
  const name = file.path.split('/').at(-1) ?? file.path
  const connects = file.connects.map((c) => c.split('/').at(-1)).join(', ')

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
        {/* render the SidebarMenuButton AS the trigger so it stays a direct
            sibling of SidebarMenuBadge — the badge's vertical position relies on
            the `peer/menu-button` relationship, which an extra trigger wrapper
            would break (badge falls to the bottom of the row). */}
        <ContextMenuTrigger
          render={
            <SidebarMenuButton
              className="h-auto py-1"
              onClick={() =>
                openTab({
                  id: tabId('diff', file.path),
                  kind: 'diff',
                  title: name,
                  path: file.path,
                })
              }
              onMouseEnter={() => prefetchDiff(file.path)}
            />
          }
        >
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
                <Check className="size-3 shrink-0 self-center text-success" aria-label="Reviewed" />
              )}
              <span className={cn('truncate', isReviewed && 'text-muted-foreground line-through')}>
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
        </ContextMenuTrigger>
        <ContextMenuContent>
          {isReviewed ? (
            <ContextMenuItem onClick={async () => unmark(file.path)}>
              Unmark reviewed
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={async () => mark(file.path)}>Mark reviewed</ContextMenuItem>
          )}
          {/* Deleted files no longer exist on disk, so opening them would error. */}
          {file.status !== 'deleted' && (
            <ContextMenuItem onClick={openFile}>Open file</ContextMenuItem>
          )}
          {file.unstaged && (
            <ContextMenuItem onClick={() => stageFile(file.path)}>Stage</ContextMenuItem>
          )}
          {file.staged && (
            <ContextMenuItem onClick={() => unstageFile(file.path)}>Unstage</ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <SidebarMenuBadge className={cn('font-mono', statusBadge[file.status].className)}>
        {statusBadge[file.status].label}
      </SidebarMenuBadge>
    </SidebarMenuItem>
  )
}

export function ChangesList(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const { groups, refresh } = useGitFlow()
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
      <div className="flex items-center justify-between px-2">
        <span className="text-xs text-muted-foreground">
          {total} changed {total === 1 ? 'file' : 'files'}
          {reviewedCount > 0 && ` · ${reviewedCount} reviewed`}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh changes">
          <RefreshCw />
        </Button>
      </div>
      {total === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
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
                />
              ))}
            </SidebarMenu>
          </div>
        ))
      )}
    </div>
  )
}
