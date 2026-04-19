import { Button } from '@renderer/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from '@renderer/components/ui/sidebar'
import { useRepoStore } from '@renderer/stores/repo'
import { FolderOpen } from 'lucide-react'
import { FileTree } from './file-tree'

export function AppSidebar(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openRepo = useRepoStore((s) => s.openRepo)

  return (
    <Sidebar>
      <SidebarHeader className="flex-row items-center justify-between border-b">
        <span className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {repo?.name ?? 'Files'}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={openRepo}
          aria-label="Open repository"
          title="Open repository"
        >
          <FolderOpen />
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {repo ? (
              <FileTree rootPath={repo.path} />
            ) : (
              <p className="p-2 text-sm text-muted-foreground">No repository open</p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
