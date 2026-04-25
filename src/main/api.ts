import { initTRPC } from '@trpc/server'
import { dialog } from 'electron'
import { readdir, readFile, stat } from 'fs/promises'
import { basename, join } from 'path'
import { z } from 'zod'
import { loadConfig, saveConfig } from './config-store'
import { hiddenPathsFor, withHiddenPath, withoutHiddenPath, withRecentRepo } from './repo-config'

const t = initTRPC.create({ isServer: true })

export interface RepoInfo {
  path: string
  name: string
}

export interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'dir'
  hidden: boolean
}

const toRepoInfo = (path: string): RepoInfo => ({ path, name: basename(path) })

async function recordRecent(path: string): Promise<void> {
  await saveConfig(withRecentRepo(await loadConfig(), path))
}

export const router = t.router({
  openRepo: t.procedure.query(async (): Promise<RepoInfo | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    const path = result.filePaths[0]
    if (!path) return null
    await recordRecent(path)
    return toRepoInfo(path)
  }),

  openRepoPath: t.procedure.input(z.string()).mutation(async ({ input }): Promise<RepoInfo> => {
    await stat(input)
    await recordRecent(input)
    return toRepoInfo(input)
  }),

  recentRepos: t.procedure.query(async (): Promise<RepoInfo[]> => {
    const config = await loadConfig()
    return config.recentRepos.map(toRepoInfo)
  }),

  readDir: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string(), showHidden: z.boolean() }))
    .query(async ({ input }): Promise<DirEntry[]> => {
      const hidden = hiddenPathsFor(await loadConfig(), input.repoPath)
      const entries = await readdir(input.path, { withFileTypes: true })
      return entries
        .map(
          (entry): DirEntry => ({
            name: entry.name,
            path: join(input.path, entry.name),
            kind: entry.isDirectory() ? 'dir' : 'file',
            hidden: hidden.has(join(input.path, entry.name)),
          }),
        )
        .filter((entry) => input.showHidden || !entry.hidden)
        .sort((a, b) =>
          a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1,
        )
    }),

  hidePath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await saveConfig(withHiddenPath(await loadConfig(), input.repoPath, input.path))
    }),

  unhidePath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await saveConfig(withoutHiddenPath(await loadConfig(), input.repoPath, input.path))
    }),

  readFile: t.procedure.input(z.string()).query(({ input }) => readFile(input, 'utf8')),
})

export type AppRouter = typeof router
