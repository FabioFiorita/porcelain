import { Button } from '@renderer/components/ui/button'
import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@renderer/components/ui/sidebar'
import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ChangedFile, FileStatus } from '../../../../main/diff'

const statusBadge: Record<FileStatus, { label: string; className: string }> = {
  modified: { label: 'M', className: 'text-amber-500' },
  added: { label: 'A', className: 'text-emerald-500' },
  deleted: { label: 'D', className: 'text-red-500' },
  renamed: { label: 'R', className: 'text-sky-500' },
  untracked: { label: 'U', className: 'text-emerald-500' },
}

export function ChangesList(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const [changes, setChanges] = useState<ChangedFile[] | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (repo) setChanges(await trpc.gitStatus.query(repo.path))
  }, [repo])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (changes === null) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2">
        <span className="text-xs text-muted-foreground">
          {changes.length} changed {changes.length === 1 ? 'file' : 'files'}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh changes">
          <RefreshCw />
        </Button>
      </div>
      <SidebarMenu>
        {changes.map((file) => (
          <SidebarMenuItem key={file.path}>
            <SidebarMenuButton
              onClick={() =>
                openTab({
                  id: `diff:${file.path}`,
                  kind: 'diff',
                  title: file.path.split('/').at(-1) ?? file.path,
                  path: file.path,
                })
              }
            >
              <span className="truncate" title={file.path}>
                {file.path}
              </span>
            </SidebarMenuButton>
            <SidebarMenuBadge className={cn('font-mono', statusBadge[file.status].className)}>
              {statusBadge[file.status].label}
            </SidebarMenuBadge>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </div>
  )
}
