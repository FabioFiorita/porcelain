import { join } from 'node:path'

/**
 * Daemon-root Project store layout: `<homeDir>/projects/<projectId>/`.
 *
 * Default Project data belongs to the owning Environment daemon's `$PORCELAIN_HOME`
 * under a stable Project record, not to a checkout that an
 * agent can delete. Canvases (`canvas-porcelain.ts`) and Actions both hang off
 * this one root, so the two cannot drift into separate layouts.
 *
 * `homeDir` is always the caller's resolved `porcelainHome()`. Taking it as a
 * parameter instead of reading the env here keeps the layout testable without
 * env mutation, and lets the CLI and daemon agree on one path by construction.
 */

export function projectStoreDir(homeDir: string, projectId: string): string {
  return join(homeDir, 'projects', projectId)
}

/** Files that live directly in one Project's store directory. */
export const PROJECT_STORE_FILES = {
  actions: 'actions.json',
  overrides: 'project.json',
} as const

/** The saved-commands document for one Project — daemon-owned, never repo-local. */
export function projectActionsPath(homeDir: string, projectId: string): string {
  return join(projectStoreDir(homeDir, projectId), PROJECT_STORE_FILES.actions)
}

/**
 * The PRIVATE project navigation defaults (hidden/pinned paths) — the
 * daemon-root counterpart of the tracked `<repo>/.porcelain/project.json` overlay.
 *
 * The private and tracked documents share these promotable fields, while personal layers and
 * Worktree profiles remain daemon-owned.
 */
export function projectOverridesPath(homeDir: string, projectId: string): string {
  return join(projectStoreDir(homeDir, projectId), PROJECT_STORE_FILES.overrides)
}
