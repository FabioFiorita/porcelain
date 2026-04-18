import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { FolderTree } from 'lucide-react'

export function Sidebar(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-9 items-center gap-2 border-b px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <FolderTree className="size-3.5" />
        Files
      </div>
      <ScrollArea className="flex-1">
        <p className="p-3 text-sm text-muted-foreground">No repository open</p>
      </ScrollArea>
    </div>
  )
}
