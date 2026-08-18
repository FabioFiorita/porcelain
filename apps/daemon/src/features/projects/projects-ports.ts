import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import type { BrowseDirsOutput, ProjectInfo } from '@porcelain/contracts/projects'

export type ProjectsPortError = 'not-found' | 'not-a-directory' | 'unavailable'

export type ProjectsPortResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: ProjectsPortError }

export type ProjectsPort = Readonly<{
  inspectProject: (path: string) => Promise<ProjectsPortResult<ProjectInfo>>
  browseDirectories: (path: string | null) => Promise<ProjectsPortResult<BrowseDirsOutput>>
}>

export type ProjectsWorktree = Readonly<{
  isLinkedWorktree: (path: string) => Promise<boolean>
}>

export type ProjectsEffects = Readonly<{
  warmFileList: (path: string) => void
}>

function nodeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  const code = error.code
  return typeof code === 'string' ? code : undefined
}

function mapHostError(error: unknown): ProjectsPortError {
  const code = nodeErrorCode(error)
  if (code === 'ENOENT') return 'not-found'
  if (code === 'ENOTDIR') return 'not-a-directory'
  return 'unavailable'
}

export type CreateNodeProjectsPortOptions = Readonly<{
  /**
   * Include dot-prefixed directories in browse listings. A production daemon hides them —
   * dotfile clutter serves no real checkout. A dev daemon needs them: `pnpm playground new`
   * (the workflow root AGENTS.md documents) writes fleet fixtures under a `.fleet` segment
   * precisely because no managed worktree slug can start with `.` (playground.mjs), so hiding
   * dot-directories here makes every fixture that command creates unreachable through this
   * same "Open project" dialog. Safe either way: the dev playground boundary (`pathAllowed` in
   * server.ts) still gates what can actually be opened, independent of what can be seen.
   */
  showHidden?: boolean
}>

export function createNodeProjectsPort(options: CreateNodeProjectsPortOptions = {}): ProjectsPort {
  const showHidden = options.showHidden ?? false
  return Object.freeze({
    async inspectProject(path: string): Promise<ProjectsPortResult<ProjectInfo>> {
      try {
        const info = await stat(path)
        if (!info.isDirectory()) return { ok: false, error: 'not-a-directory' }
        return { ok: true, value: { path, name: basename(path) } }
      } catch (error) {
        return { ok: false, error: mapHostError(error) }
      }
    },

    async browseDirectories(path: string | null): Promise<ProjectsPortResult<BrowseDirsOutput>> {
      const target = path ?? homedir()
      try {
        const dirents = await readdir(target, { withFileTypes: true })
        const entries = dirents
          .filter((entry) => entry.isDirectory() && (showHidden || !entry.name.startsWith('.')))
          .map((entry) => {
            const entryPath = join(target, entry.name)
            return {
              name: entry.name,
              path: entryPath,
              isRepo: existsSync(join(entryPath, '.git')),
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'accent' }))

        const parentPath = dirname(target)
        return {
          ok: true,
          value: {
            path: target,
            parent: parentPath === target ? null : parentPath,
            entries,
          },
        }
      } catch (error) {
        return { ok: false, error: mapHostError(error) }
      }
    },
  })
}
