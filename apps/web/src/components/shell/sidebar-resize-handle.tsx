import {
  RIGHT_SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SPLIT_MAX_RATIO,
  SPLIT_MIN_RATIO,
  usePreferencesStore,
} from '@renderer/stores/preferences'

const clampWidth = (width: number, min: number = SIDEBAR_MIN_WIDTH): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(min, width))

const clampRatio = (ratio: number): number =>
  Math.min(SPLIT_MAX_RATIO, Math.max(SPLIT_MIN_RATIO, ratio))

export function SidebarResizeHandle(): React.JSX.Element {
  const setSidebarWidth = usePreferencesStore((s) => s.setSidebarWidth)

  const handleStartResize = (event: React.MouseEvent): void => {
    event.preventDefault()
    // Write the CSS variable directly during the drag — going through the
    // store would re-render the whole app (and persist) on every mousemove.
    const wrapper = event.currentTarget.closest<HTMLElement>('[data-slot="sidebar-wrapper"]')
    let width = usePreferencesStore.getState().sidebarWidth
    const handleMouseMove = (e: MouseEvent): void => {
      width = clampWidth(e.clientX)
      wrapper?.style.setProperty('--sidebar-width', `${width}px`)
    }
    const handleMouseUp = (): void => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.removeProperty('cursor')
      setSidebarWidth(width)
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only resize affordance
    <div
      className="absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize transition-colors hover:bg-sidebar-border active:bg-sidebar-border"
      onMouseDown={handleStartResize}
    />
  )
}

export function RightSidebarResizeHandle(): React.JSX.Element {
  const setRightSidebarWidth = usePreferencesStore((s) => s.setRightSidebarWidth)

  const handleStartResize = (event: React.MouseEvent): void => {
    event.preventDefault()
    // Same direct CSS-variable strategy as the left handle, against the inner
    // (right) provider's wrapper; width is measured from the window's right edge.
    const wrapper = event.currentTarget.closest<HTMLElement>('[data-slot="sidebar-wrapper"]')
    let width = usePreferencesStore.getState().rightSidebarWidth
    const handleMouseMove = (e: MouseEvent): void => {
      width = clampWidth(window.innerWidth - e.clientX, RIGHT_SIDEBAR_MIN_WIDTH)
      wrapper?.style.setProperty('--sidebar-width', `${width}px`)
    }
    const handleMouseUp = (): void => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.removeProperty('cursor')
      setRightSidebarWidth(width)
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only resize affordance
    <div
      className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-col-resize transition-colors hover:bg-sidebar-border active:bg-sidebar-border"
      onMouseDown={handleStartResize}
    />
  )
}

/**
 * Vertical divider between the two viewer panes when split. Drives the
 * `--split-left` CSS var (left pane's flex-basis) on the split container
 * directly during the drag (same no-re-render trick as the width handles) and
 * persists the ratio on release.
 */
export function SplitResizeHandle(): React.JSX.Element {
  const setSplitRatio = usePreferencesStore((s) => s.setSplitRatio)

  const handleStartResize = (event: React.MouseEvent): void => {
    event.preventDefault()
    const container = event.currentTarget.closest<HTMLElement>('[data-slot="viewer-split"]')
    let ratio = usePreferencesStore.getState().splitRatio
    const handleMouseMove = (e: MouseEvent): void => {
      if (!container) return
      const rect = container.getBoundingClientRect()
      ratio = clampRatio((e.clientX - rect.left) / rect.width)
      container.style.setProperty('--split-left', `${ratio * 100}%`)
    }
    const handleMouseUp = (): void => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.removeProperty('cursor')
      setSplitRatio(ratio)
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only resize affordance
    <div
      className="z-20 w-1.5 shrink-0 cursor-col-resize bg-border/50 transition-colors hover:bg-sidebar-border active:bg-sidebar-border"
      onMouseDown={handleStartResize}
    />
  )
}
