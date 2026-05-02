import { usePreferencesStore } from '@renderer/stores/preferences'

export function SidebarResizeHandle(): React.JSX.Element {
  const setSidebarWidth = usePreferencesStore((s) => s.setSidebarWidth)

  const startResize = (event: React.MouseEvent): void => {
    event.preventDefault()
    const onMove = (e: MouseEvent): void => setSidebarWidth(e.clientX)
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.removeProperty('cursor')
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
