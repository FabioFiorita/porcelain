import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@renderer/components/ui/resizable'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@renderer/components/ui/sidebar'
import { useRepoStore } from '@renderer/stores/repo'
import { useEffect } from 'react'
import { AppSidebar } from './app-sidebar'
import { TabBar } from './tab-bar'
import { TerminalPane } from './terminal-pane'
import { Viewer } from './viewer'
import { Welcome } from './welcome'

export function AppShell(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const restoring = useRepoStore((s) => s.restoring)
  const restoreLastRepo = useRepoStore((s) => s.restoreLastRepo)

  useEffect(() => {
    restoreLastRepo()
  }, [restoreLastRepo])

  if (restoring) {
    return <div className="dark h-screen bg-background" />
  }

  if (!repo) {
    return (
      <div className="dark h-screen bg-background text-foreground">
        <Welcome />
      </div>
    )
  }

  return (
    <div className="dark h-screen bg-background text-foreground">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="h-screen min-w-0">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="75%">
              <div className="flex h-full flex-col">
                <div className="flex h-10 items-end border-b bg-sidebar">
                  <SidebarTrigger className="m-1 self-center" />
                  <TabBar />
                </div>
                <div className="min-h-0 flex-1">
                  <Viewer />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize="25%" minSize="80px" collapsible>
              <TerminalPane />
            </ResizablePanel>
          </ResizablePanelGroup>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
