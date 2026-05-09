import { ChangesList } from '@renderer/components/git/changes-list'
import { HistoryList } from '@renderer/components/git/history-list'
import { WorktreeSwitcher } from '@renderer/components/git/worktree-switcher'
import { Button } from '@renderer/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from '@renderer/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useRepoStore } from '@renderer/stores/repo'
import { Eye, EyeOff, FolderOpen } from 'lucide-react'
import { FileTree } from './file-tree'
import { SidebarResizeHandle } from './sidebar-resize-handle'

export function AppSidebar(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openRepo = useRepoStore((s) => s.openRepo)
  const showHidden = useRepoStore((s) => s.showHidden)
  const toggleShowHidden = useRepoStore((s) => s.toggleShowHidden)

  return (
    <Sidebar>
      <SidebarResizeHandle />
      <SidebarHeader className="app-drag h-10 flex-row items-center justify-between border-b py-0 pl-[4.75rem]">
        <span className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {repo?.name ?? 'Files'}
        </span>
        <div className="app-no-drag flex items-center">
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
        {repo ? (
          <Tabs defaultValue="files" className="flex h-full flex-col gap-0">
            <TabsList className="mx-2 mt-2 grid w-auto grid-cols-3">
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="changes">Changes</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="files">
              <SidebarGroup>
                <SidebarGroupContent>
                  <FileTree rootPath={repo.path} />
                </SidebarGroupContent>
              </SidebarGroup>
            </TabsContent>
            <TabsContent value="changes">
              <SidebarGroup>
                <SidebarGroupContent>
                  <ChangesList />
                </SidebarGroupContent>
              </SidebarGroup>
            </TabsContent>
            <TabsContent value="history">
              <SidebarGroup>
                <SidebarGroupContent>
                  <HistoryList />
                </SidebarGroupContent>
              </SidebarGroup>
            </TabsContent>
          </Tabs>
        ) : (
          <p className="p-2 text-sm text-muted-foreground">No repository open</p>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <WorktreeSwitcher />
      </SidebarFooter>
    </Sidebar>
  )
}
