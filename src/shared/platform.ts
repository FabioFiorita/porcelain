/**
 * The one platform resolver for main AND preload — which desktop OS the shell is
 * running on. Three cases matter to the renderer seam: macOS (Cmd-primary, native
 * traffic lights), Linux (Ctrl-primary, custom window controls), and Windows
 * (Ctrl-primary too, folded in for free). The preload reads
 * this once at boot and hands it to the renderer on `window.porcelain.platform`;
 * the renderer's lib/platform.ts keys `isLinuxShell` off it.
 *
 * `PORCELAIN_FORCE_LINUX=1` forces the Linux answer even on a Mac, so the Linux
 * chrome/labels can be previewed with `pnpm dev` without a Linux box. It wins over
 * the real platform (that's the point of a dev override).
 *
 * Pure and Electron-free (reads only `process`), so the preload can import it at
 * runtime (electron-vite bundles it), src/main can call it, and a unit test can
 * exercise it — one source of truth, no lockstep copy.
 */
export type Platform = 'darwin' | 'linux' | 'win32'

export function resolvePlatform(): Platform {
  if (process.env.PORCELAIN_FORCE_LINUX === '1') return 'linux'
  if (process.platform === 'darwin') return 'darwin'
  if (process.platform === 'win32') return 'win32'
  // Every other Unix (linux + the BSDs) takes the Linux path: Ctrl-primary, opaque.
  return 'linux'
}
