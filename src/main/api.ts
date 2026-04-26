import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { dialog } from 'electron'
import { readdir, readFile, stat } from 'fs/promises'
import { basename, join } from 'path'
import { z } from 'zod'
import { loadConfig, saveConfig } from './config-store'
import { gitDiffFile, gitStatus } from './git'
import { hiddenPathsFor, withHiddenPath, withoutHiddenPath, withRecentRepo } from './repo-config'
import {
  createTerminal,
  hasTerminal,
  resizeTerminal,
  subscribeTerminal,
  terminalScrollback,
  writeTerminal,
} from './terminal'

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

  gitStatus: t.procedure.input(z.string()).query(({ input }) => gitStatus(input)),

  gitDiffFile: t.procedure
    .input(z.object({ repoPath: z.string(), filePath: z.string() }))
    .query(({ input }) => gitDiffFile(input.repoPath, input.filePath)),

  termCreate: t.procedure.input(z.object({ cwd: z.string() })).mutation(({ input }) => ({
    id: createTerminal(input.cwd),
  })),

  termExists: t.procedure.input(z.string()).query(({ input }) => hasTerminal(input)),

  termScrollback: t.procedure.input(z.string()).query(({ input }) => terminalScrollback(input)),

  termWrite: t.procedure
    .input(z.object({ id: z.string(), data: z.string() }))
    .mutation(({ input }) => writeTerminal(input.id, input.data)),

  termResize: t.procedure
    .input(z.object({ id: z.string(), cols: z.number().int(), rows: z.number().int() }))
    .mutation(({ input }) => resizeTerminal(input.id, input.cols, input.rows)),

  termOnData: t.procedure
    .input(z.string())
    .subscription(({ input }) =>
      observable<string>((emit) => subscribeTerminal(input, (data) => emit.next(data))),
    ),
})

export type AppRouter = typeof router
