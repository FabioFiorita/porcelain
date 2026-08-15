import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@renderer/components/ui/empty'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@renderer/components/ui/sidebar'
import { useHubTarget } from '@renderer/stores/hub-selection'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { LayoutPanelTop } from 'lucide-react'
import { useCanvasList } from './project-data'

/** Right sidebar surface: every Canvas recorded for the selected Project (ADR 0002). */
export function CanvasList(): React.JSX.Element {
  const target = useHubTarget()
  const openTab = useTabsStore((s) => s.openTab)
  const canvases = useCanvasList(target?.projectId ?? null)

  if (target === null) {
    return (
      <p className="p-3 text-sm text-muted-foreground">Select a Worktree to see its Canvases.</p>
    )
  }

  if (canvases.length === 0) {
    return (
      <Empty
        data-testid={TestIds.canvasListEmpty}
        className="mx-2 mt-1 min-h-36 border-none bg-muted/20 px-4 py-8"
      >
        <EmptyMedia>
          <LayoutPanelTop />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No Canvases yet</EmptyTitle>
          <EmptyDescription>
            Agent-authored explanation shows up here once written (`porcelain canvas set`).
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <SidebarMenu data-testid={TestIds.canvasList}>
      {canvases.map((canvas) => (
        <SidebarMenuItem key={canvas.id}>
          <SidebarMenuButton
            data-testid={TestIds.canvasListItem(canvas.id)}
            className="h-auto py-1 text-sm-minus"
            onClick={() =>
              openTab(targetedTab('canvas', canvas.id, { title: canvas.title }, activeTabTarget()))
            }
          >
            <div className="flex min-w-0 flex-col items-start">
              <span className="max-w-full truncate">{canvas.title}</span>
              <span className="max-w-full truncate text-xs text-muted-foreground">
                {canvas.kind} · {canvas.updatedAt}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
