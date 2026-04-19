import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@renderer/components/ui/resizable'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@renderer/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { TabBar } from './tab-bar'
import { TerminalPane } from './terminal-pane'
import { Viewer } from './viewer'

export function AppShell(): React.JSX.Element {
  return (
    <div className="dark h-screen bg-background text-foreground">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="h-screen min-w-0">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="75%">
              <div className="flex h-full flex-col">
                <div className="flex items-end border-b bg-sidebar">
                  <SidebarTrigger className="m-1" />
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
