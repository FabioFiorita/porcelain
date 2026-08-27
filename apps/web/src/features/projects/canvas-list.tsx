import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@renderer/components/ui/empty'
import { SidebarMenu } from '@renderer/components/ui/sidebar'
import { useHubTarget } from '@renderer/stores/hub-selection'
import { TestIds } from '@shared/test-ids'
import { LayoutPanelTop } from 'lucide-react'
import { CanvasListRow } from './canvas-list-row'
import { useCanvasList } from './project-data'

/**
 * Right sidebar surface: every Canvas the selected Worktree resolves (ADR 0002).
 * The Worktree's checkout path is passed through so its tracked `.porcelain/`
 * overlay is merged over the private records — tracked wins on the same id.
 */
export function CanvasList(): React.JSX.Element {
  const target = useHubTarget()
  const canvases = useCanvasList(
    target?.projectId ?? null,
    target?.path ?? null,
    target?.environmentId ?? null,
    target?.worktreeId ?? null,
  )

  if (target === null) {
    return (
      <p className="px-2 pt-2 text-sm text-muted-foreground">
        Select a Worktree to see its Canvases.
      </p>
    )
  }

  if (canvases.length === 0) {
    return (
      <Empty
        data-testid={TestIds.canvasListEmpty}
        className="mx-2 mt-2 min-h-36 border-none bg-muted/20 px-4 py-8"
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
        <CanvasListRow key={canvas.id} canvas={canvas} target={target} />
      ))}
    </SidebarMenu>
  )
}
