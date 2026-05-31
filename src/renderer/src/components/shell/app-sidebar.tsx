import { ChangesList } from '@renderer/components/git/changes-list'
import { HistoryList } from '@renderer/components/git/history-list'
import { WorktreeSwitcher } from '@renderer/components/git/worktree-switcher'
import { SettingsDialog } from '@renderer/components/settings/settings-dialog'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { Eye, EyeOff, Files, GitCompareArrows, History } from 'lucide-react'
import { FileTree } from './file-tree'
import { ProjectSwitcher } from './project-switcher'
import { SidebarResizeHandle } from './sidebar-resize-handle'

export function AppSidebar(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const showHidden = useRepoStore((s) => s.showHidden)
  const toggleShowHidden = useRepoStore((s) => s.toggleShowHidden)
  const sidebarTab = usePreferencesStore((s) => s.sidebarTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)

  return (
    <Sidebar>
      <SidebarResizeHandle />
      <SidebarHeader className="app-drag h-10 flex-row items-center justify-between border-b py-0 pl-[4.75rem]">
        <ProjectSwitcher />
        <div className="app-no-drag flex items-center">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleShowHidden}
                  aria-label={showHidden ? 'Conceal hidden entries' : 'Show hidden entries'}
                >
                  {showHidden ? <Eye /> : <EyeOff />}
                </Button>
              }
            />
            <TooltipContent>
              {showHidden ? 'Conceal hidden entries' : 'Show hidden entries'}
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {repo ? (
          <Tabs
            value={sidebarTab}
            onValueChange={(value) => {
              if (value === 'files' || value === 'changes' || value === 'history') {
                setSidebarTab(value)
              }
            }}
            className="flex h-full flex-col gap-0"
          >
            <TabsList className="mx-2 mt-2 grid w-auto grid-cols-3">
              <TabsTrigger value="files">
                <Files className="text-sky-400" /> Files
              </TabsTrigger>
              <TabsTrigger value="changes">
                <GitCompareArrows className="text-amber-400" /> Changes
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="text-violet-400" /> History
              </TabsTrigger>
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
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <WorktreeSwitcher />
          </div>
          <SettingsDialog />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
