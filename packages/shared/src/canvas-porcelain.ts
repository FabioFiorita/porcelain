import { isAbsolute, join, relative, sep } from 'node:path'
import { projectStoreDir } from './project-store'

/**
 * Daemon-root Canvas storage layout: `<homeDir>/projects/<projectId>/canvases/`.
 * Canvases are owned by the stable Project record (ADR 0002), not by an ephemeral
 * Worktree, so they live under `$PORCELAIN_HOME` rather than `.porcelain/` in the
 * repo — and outlive a deleted checkout. `homeDir` is always the caller's resolved
 * `porcelainHome()`; taking it as a parameter (rather than reading the env here)
 * keeps this module testable without env mutation, matching `hub-inventory-store`.
 *
 * The CLI and the daemon both import this layout so a Canvas the CLI writes is a
 * Canvas the daemon's store reads back with no format drift.
 */

export const CANVAS_INDEX_FILE = 'index.json'

export function projectCanvasesDir(homeDir: string, projectId: string): string {
  return join(projectStoreDir(homeDir, projectId), 'canvases')
}

/** The manifest listing every Canvas record for one Project. */
export function canvasIndexPath(homeDir: string, projectId: string): string {
  return join(projectCanvasesDir(homeDir, projectId), CANVAS_INDEX_FILE)
}

/** The bundle directory for one Canvas: its entry file plus sibling assets. */
export function canvasBundleDir(homeDir: string, projectId: string, canvasId: string): string {
  return join(projectCanvasesDir(homeDir, projectId), canvasId)
}

/**
 * Exact "is `candidate` inside `dir`" containment check — never `startsWith('..')`
 * alone, which false-positives a name like `..foo`. Shared by the daemon's
 * canvas-store.ts (the real gate, also realpath-checked there) and the CLI's
 * canvas-file.ts (a lexical pre-gate only — canvas-store.ts's own read is what
 * actually enforces this for a Canvas the CLI writes).
 */
export function isInsideDir(dir: string, candidate: string): boolean {
  const rel = relative(dir, candidate)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}
