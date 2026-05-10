import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  usePreferencesStore,
} from '@renderer/stores/preferences'

const clampWidth = (width: number): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width))

export function SidebarResizeHandle(): React.JSX.Element {
  const setSidebarWidth = usePreferencesStore((s) => s.setSidebarWidth)

  const startResize = (event: React.MouseEvent): void => {
    event.preventDefault()
    // Write the CSS variable directly during the drag — going through the
    // store would re-render the whole app (and persist) on every mousemove.
    const wrapper = event.currentTarget.closest<HTMLElement>('[data-slot="sidebar-wrapper"]')
    let width = usePreferencesStore.getState().sidebarWidth
    const onMove = (e: MouseEvent): void => {
      width = clampWidth(e.clientX)
      wrapper?.style.setProperty('--sidebar-width', `${width}px`)
    }
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.removeProperty('cursor')
      setSidebarWidth(width)
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only resize affordance
    <div
      className="absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize transition-colors hover:bg-sidebar-border active:bg-sidebar-border"
      onMouseDown={startResize}
    />
  )
}
