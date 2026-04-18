import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@renderer/components/ui/resizable'
import { Sidebar } from './sidebar'
import { TabBar } from './tab-bar'
import { TerminalPane } from './terminal-pane'
import { Viewer } from './viewer'

export function AppShell(): React.JSX.Element {
  return (
    <div className="dark h-screen bg-background text-foreground">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="20%" minSize="160px" collapsible>
          <Sidebar />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="80%">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="75%">
              <div className="flex h-full flex-col">
                <TabBar />
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
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
