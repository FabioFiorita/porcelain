import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { z } from 'zod'
import { type BrowseResult, browseDirs } from '../git/browse'
import { warmFileList } from '../git/git'
import { isLinkedWorktree } from '../git/linked-worktree'
import { withoutRecentRepo, withRecentRepo } from '../repo-config'
import { seedWorktreeSettings } from '../repo-settings'
import { loadConfig, updateConfig } from '../stores/config-store'
import {
  hiddenPathsForRepo,
  hidePath as hideScopePath,
  pinnedPathsForRepo,
  pinPath as pinScopePath,
  unhidePath as unhideScopePath,
  unpinPath as unpinScopePath,
} from '../stores/scope-store'
import { publicProcedure, t } from '../trpc'

export interface RepoInfo {
  path: string
  name: string
}

export interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'dir'
  hidden: boolean
  pinned: boolean
}

const toRepoInfo = (path: string): RepoInfo => ({ path, name: basename(path) })

async function recordRecent(path: string): Promise<void> {
  await updateConfig((config) => withRecentRepo(config, path))
}

export const reposRouter = t.router({
  openRepoPath: publicProcedure.input(z.string()).mutation(async ({ input }): Promise<RepoInfo> => {
    await stat(input)
    await recordRecent(input)
    // A worktree opened for the first time inherits its family's companion data
    // (see seedWorktreeSettings). Never overwrites, never throws.
    await seedWorktreeSettings(input)
    warmFileList(input)
    return toRepoInfo(input)
  }),

  recentRepos: publicProcedure
    // Linked worktrees are dropped by default: a worktree already has a home in the
    // footer's worktree switcher, so listing it as a project too shows one checkout
    // under two identities. They stay in the STORED recents — `includeWorktrees` is
    // what lets last-repo restore land back in the worktree the human left.
    .input(z.object({ includeWorktrees: z.boolean().default(false) }).optional())
    .query(async ({ input }): Promise<RepoInfo[]> => {
      const includeWorktrees = input?.includeWorktrees ?? false
      const config = await loadConfig()
      const existing = await Promise.all(
        config.recentRepos.map(async (path) => {
          try {
            await stat(path)
            if (!includeWorktrees && (await isLinkedWorktree(path))) return null
            return path
          } catch {
            return null
          }
        }),
      )
      return existing.filter((p): p is string => p !== null).map(toRepoInfo)
    }),

  // Drop a repo from the recents list. Removes only the recents entry — scope
  // (hidden/pinned) lives in ~/.porcelain/scope.json and is keyed by path, so it
  // survives remove + re-open.
  removeRecentRepo: publicProcedure.input(z.string()).mutation(async ({ input }) => {
    await updateConfig((config) => withoutRecentRepo(config, input))
  }),

  // Daemon-side directory browser for the repo picker (replaces the native
  // open-folder dialog — repos are daemon paths, so a remote daemon must pick
  // ITS paths; see remote-envs decision 5). `null` starts at the daemon home.
  // Directory NAMES only, never file contents; any token-holder can already open
  // any path via openRepoPath, so this widens nothing.
  browseDirs: publicProcedure
    .input(z.string().nullable())
    .query(({ input }): Promise<BrowseResult> => browseDirs(input)),

  readDir: publicProcedure
    .input(z.object({ repoPath: z.string(), path: z.string(), showHidden: z.boolean() }))
    .query(async ({ input }): Promise<DirEntry[]> => {
      const [hidden, pinnedList] = await Promise.all([
        hiddenPathsForRepo(input.repoPath),
        pinnedPathsForRepo(input.repoPath),
      ])
      const pinned = new Set(pinnedList)
      const entries = await readdir(input.path, { withFileTypes: true })
      return entries
        .filter((entry) => entry.name !== '.DS_Store')
        .map(
          (entry): DirEntry => ({
            name: entry.name,
            path: join(input.path, entry.name),
            kind: entry.isDirectory() ? 'dir' : 'file',
            hidden: hidden.has(join(input.path, entry.name)),
            pinned: pinned.has(join(input.path, entry.name)),
          }),
        )
        .filter((entry) => input.showHidden || !entry.hidden)
        .sort((a, b) =>
          a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1,
        )
    }),

  hidePath: publicProcedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await hideScopePath(input.repoPath, input.path)
    }),

  unhidePath: publicProcedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await unhideScopePath(input.repoPath, input.path)
    }),

  pinPath: publicProcedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await pinScopePath(input.repoPath, input.path)
    }),

  unpinPath: publicProcedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await unpinScopePath(input.repoPath, input.path)
    }),

  pinnedEntries: publicProcedure.input(z.string()).query(async ({ input }): Promise<DirEntry[]> => {
    const [hidden, pinned] = await Promise.all([
      hiddenPathsForRepo(input),
      pinnedPathsForRepo(input),
    ])
    const entries = await Promise.all(
      pinned.map(async (path): Promise<DirEntry | null> => {
        try {
          const info = await stat(path)
          return {
            name: basename(path),
            path,
            kind: info.isDirectory() ? 'dir' : 'file',
            hidden: hidden.has(path),
            pinned: true,
          }
        } catch {
          return null // pinned path no longer exists; keep the scope entry, skip the row
        }
      }),
    )
    return entries.filter((e): e is DirEntry => e !== null)
  }),
})
