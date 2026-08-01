import type { ExcalidrawScene } from '@shared/excalidraw-scene'
import { lazy, Suspense } from 'react'

/**
 * Self-host Excalidraw fonts under the app origin so CSP `font-src 'self'` works
 * (CDN loads are blocked by design — audit invariant). Vite copies
 * `node_modules/@excalidraw/excalidraw/dist/prod/fonts` → `excalidraw-assets/fonts`
 * at build/dev (see electron.vite.config.ts). Path must end with `/`.
 */
function ensureExcalidrawAssetPath(): void {
  if (typeof window === 'undefined') return
  const w = window as Window & { EXCALIDRAW_ASSET_PATH?: string }
  if (w.EXCALIDRAW_ASSET_PATH) return
  // BASE_URL is `/` in Electron and the daemon-served browser client.
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  w.EXCALIDRAW_ASSET_PATH = `${base}excalidraw-assets/`
}

/**
 * Lazy Excalidraw chunk — only loads when a canvas tab mounts with medium
 * `excalidraw`. Keeps the main renderer graph free of the ~1MB+ package.
 */
const LazyExcalidraw = lazy(async () => {
  ensureExcalidrawAssetPath()
  const [{ Excalidraw }, css] = await Promise.all([
    import('@excalidraw/excalidraw'),
    import('@excalidraw/excalidraw/index.css'),
  ])
  void css
  return {
    default: function ExcalidrawInner({ scene }: { scene: ExcalidrawScene }): React.JSX.Element {
      // Prefer the app's dark chrome; agent scenes often ship a light export default
      // that looks washed out / soft against Porcelain's opaque dark shell (P5).
      const background =
        typeof scene.appState?.viewBackgroundColor === 'string'
          ? scene.appState.viewBackgroundColor
          : '#090b0c'
      return (
        <Excalidraw
          theme="dark"
          initialData={{
            elements: scene.elements as never,
            appState: {
              ...(scene.appState ?? {}),
              viewBackgroundColor: background,
              // Read-only canvas — no editing chrome for v1.
              viewModeEnabled: true,
              // Crisp grid off; zen hides the soft UI chrome that fought our border.
              zenModeEnabled: true,
            },
            files: (scene.files ?? {}) as never,
            scrollToContent: true,
          }}
          viewModeEnabled
          zenModeEnabled
          // Let Excalidraw size to the device pixel ratio (sharp on Retina / HiDPI).
          detectScroll
          handleKeyboardGlobally={false}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              export: false,
              saveToActiveFile: false,
              toggleTheme: false,
              changeViewBackgroundColor: false,
              clearCanvas: false,
            },
          }}
        />
      )
    },
  }
})

/**
 * Full-height read-only Excalidraw host for Review canvas panes.
 * Scene is inert JSON — no dangerouslySetInnerHTML, no iframe.
 * Keyed by element count + first id so a new agent push remounts initialData.
 */
export function ExcalidrawHost({ scene }: { scene: ExcalidrawScene }): React.JSX.Element {
  const first = scene.elements[0]
  const firstId =
    typeof first === 'object' && first !== null && 'id' in first
      ? String((first as { id: unknown }).id)
      : '0'
  const remountKey = `${scene.elements.length}:${firstId}`

  return (
    // No outer border: Excalidraw already paints a full canvas; a nested border +
    // rounded clip made strokes look soft. Full-bleed keeps pixel edges sharp.
    <div
      className="h-full min-h-0 w-full overflow-hidden bg-background [&_.excalidraw]:h-full [&_.excalidraw]:w-full"
      style={{ WebkitFontSmoothing: 'antialiased' }}
    >
      <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading canvas…</p>}>
        <LazyExcalidraw key={remountKey} scene={scene} />
      </Suspense>
    </div>
  )
}
