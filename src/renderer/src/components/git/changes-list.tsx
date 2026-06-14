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
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { RefreshCw, Waypoints } from 'lucide-react'

const statusBadge: Record<FileStatus, { label: string; className: string }> = {
  modified: { label: 'M', className: 'text-warning' },
  added: { label: 'A', className: 'text-success' },
  deleted: { label: 'D', className: 'text-destructive' },
  renamed: { label: 'R', className: 'text-info' },
  untracked: { label: 'U', className: 'text-success' },
}

function FileRow({ file }: { file: FlowFile }): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const prefetchDiff = useDiffFilePrefetch()
  const { stageFile, unstageFile } = useFileStaging()
  const name = file.path.split('/').at(-1) ?? file.path
  const connects = file.connects.map((c) => c.split('/').at(-1)).join(', ')

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
              <span className="truncate">{name}</span>
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
  const { groups, refresh } = useGitFlow()
  const openTab = useTabsStore((s) => s.openTab)
  const repo = useRepoStore((s) => s.repo)

  if (groups === undefined) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  const total = groups.reduce((n, g) => n + g.files.length, 0)

  const openFeatureView = (): void => {
    if (!repo) return
    openTab({
      id: tabId('feature', repo.path),
      kind: 'feature',
      title: 'Feature view',
      path: repo.path,
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2">
        <span className="text-xs text-muted-foreground">
          {total} changed {total === 1 ? 'file' : 'files'}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh changes">
          <RefreshCw />
        </Button>
      </div>
      <button
        type="button"
        onClick={openFeatureView}
        className="mx-2 mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
      >
        <Waypoints className="size-3.5" />
        View full feature
      </button>
      {groups.map((group) => (
        <div key={group.layer}>
          <SidebarGroupLabel className="h-6 px-2 text-[10px] uppercase tracking-wider">
            {group.layer}
          </SidebarGroupLabel>
          <SidebarMenu>
            {group.files.map((file) => (
              <FileRow key={file.path} file={file} />
            ))}
          </SidebarMenu>
        </div>
      ))}
    </div>
  )
}
