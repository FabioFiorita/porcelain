import { Button } from '@renderer/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from '@renderer/components/ui/sidebar'
import { useRepoStore } from '@renderer/stores/repo'
import { Eye, EyeOff, FolderOpen } from 'lucide-react'
import { FileTree } from './file-tree'

export function AppSidebar(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openRepo = useRepoStore((s) => s.openRepo)
  const showHidden = useRepoStore((s) => s.showHidden)
  const toggleShowHidden = useRepoStore((s) => s.toggleShowHidden)

  return (
    <Sidebar>
      <SidebarHeader className="h-10 flex-row items-center justify-between border-b py-0">
        <span className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {repo?.name ?? 'Files'}
        </span>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleShowHidden}
            aria-label={showHidden ? 'Conceal hidden entries' : 'Show hidden entries'}
            title={showHidden ? 'Conceal hidden entries' : 'Show hidden entries'}
          >
            {showHidden ? <Eye /> : <EyeOff />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={openRepo}
            aria-label="Open repository"
            title="Open repository"
          >
            <FolderOpen />
          </Button>
        </div>
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
