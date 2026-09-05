import { type HubTarget, sameHubTarget } from '@porcelain/client-runtime/projects'
import { useFilesCut, useFilesCutStore } from '@renderer/features/files'
import { planFileMoves } from '@renderer/features/files/files-cut'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useHubRepoTarget } from '@renderer/stores/hub-repo'
import { useSelectionStore } from '@renderer/stores/selection'
import { runUserAction } from '@shared/background'
import type { DragEvent } from 'react'
import { create } from 'zustand'

const MIME = 'application/x-porcelain-files'
const useDrag = create<{
  source: { target: HubTarget; paths: string[] } | null
  over: string | null
}>(() => ({ source: null, over: null }))

export function useFileTreeDrag(path: string, directory: boolean) {
  const target = useHubRepoTarget()
  const source = useDrag((s) => s.source)
  const over = useDrag((s) => s.over)
  const { paste } = useFilesCut()
  const valid = (): boolean => {
    if (
      !directory ||
      !target ||
      !source ||
      !sameHubTarget(target, source.target) ||
      useFilesCutStore.getState().busy
    )
      return false
    try {
      return planFileMoves(target.path, source.paths, path).length > 0
    } catch {
      return false
    }
  }
  return {
    active: source !== null,
    highlighted: over === path,
    handlers: {
      onDragStart: (event: DragEvent<HTMLElement>) => {
        if (!target || useFilesCutStore.getState().busy) {
          event.preventDefault()
          return
        }
        event.stopPropagation()
        const selected = useSelectionStore.getState().selected
        useDrag.setState({
          source: { target, paths: selected.has(path) ? [...selected] : [path] },
          over: null,
        })
        event.dataTransfer.setData(MIME, 'move')
        event.dataTransfer.effectAllowed = 'move'
      },
      onDragEnd: () => useDrag.setState({ source: null, over: null }),
      onDragOver: (event: DragEvent<HTMLElement>) => {
        event.stopPropagation()
        if (!event.dataTransfer.types.includes(MIME) || !valid()) {
          event.dataTransfer.dropEffect = 'none'
          return
        }
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (over !== path) useDrag.setState({ over: path })
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          useDrag.setState({ over: null })
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.stopPropagation()
        event.preventDefault()
        if (source && valid() && event.dataTransfer.types.includes(MIME))
          runUserAction(
            () => paste(path, source),
            (error) => toastUserActionError('Move', error),
          )
        useDrag.setState({ source: null, over: null })
      },
    },
  }
}

export function FileTreeRootDrop({ rootPath }: { rootPath: string }): React.JSX.Element | null {
  const drag = useFileTreeDrag(rootPath, true)
  if (!drag.active) return null
  return (
    <div
      {...drag.handlers}
      data-testid="files-drop-root"
      className={`absolute inset-x-2 top-0 z-20 rounded-md border border-dashed bg-background p-1 text-center text-xs ${drag.highlighted ? 'border-primary bg-accent' : 'border-border text-muted-foreground'}`}
    >
      Move to project root
    </div>
  )
}
