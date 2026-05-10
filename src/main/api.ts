import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { dialog } from 'electron'
import { readdir, readFile, stat } from 'fs/promises'
import { basename, join } from 'path'
import { z } from 'zod'
import { type AppEvent, subscribeAppEvents } from './app-events'
import { loadConfig, saveConfig } from './config-store'
import { buildFlow, DEFAULT_LAYERS, type FlowGroup } from './flow'
import { fuzzySearch } from './fuzzy'
import {
  gitBranch,
  gitCommitDiff,
  gitCommitFiles,
  gitDiffFile,
  gitListFiles,
  gitLog,
  gitNumstat,
  gitStatus,
  gitWorktrees,
} from './git'
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

export type FileView =
  | { type: 'text'; content: string }
  | { type: 'image'; dataUrl: string }
  | { type: 'binary'; size: number }

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  avif: 'image/avif',
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
    const existing = await Promise.all(
      config.recentRepos.map(async (path) => {
        try {
          await stat(path)
          return path
        } catch {
          return null
        }
      }),
    )
    return existing.filter((p): p is string => p !== null).map(toRepoInfo)
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

  readFile: t.procedure.input(z.string()).query(async ({ input }): Promise<FileView> => {
    const ext = input.split('.').at(-1)?.toLowerCase() ?? ''
    const imageMime = IMAGE_MIME[ext]
    if (imageMime) {
      const buffer = await readFile(input)
      return { type: 'image', dataUrl: `data:${imageMime};base64,${buffer.toString('base64')}` }
    }
    const buffer = await readFile(input)
    if (buffer.subarray(0, 8000).includes(0)) {
      return { type: 'binary', size: buffer.length }
    }
    return { type: 'text', content: buffer.toString('utf8') }
  }),

  gitStatus: t.procedure.input(z.string()).query(({ input }) => gitStatus(input)),

  gitFlow: t.procedure.input(z.string()).query(async ({ input }): Promise<FlowGroup[]> => {
    const [files, config, stats] = await Promise.all([
      gitStatus(input),
      loadConfig(),
      gitNumstat(input),
    ])
    const layers = config.repos[input]?.layers ?? DEFAULT_LAYERS
    const sources = new Map<string, string>()
    await Promise.all(
      files.slice(0, 200).map(async (file) => {
        try {
          const content = await readFile(join(input, file.path), 'utf8')
          if (content.length < 1024 * 1024) sources.set(file.path, content)
        } catch {
          // deleted files have no working-tree source to parse
        }
      }),
    )
    const statByPath = new Map(stats.map((s) => [s.path, s]))
    return buildFlow(files, sources, layers).map((group) => ({
      ...group,
      files: group.files.map((file) => ({
        ...file,
        additions: statByPath.get(file.path)?.additions,
        deletions: statByPath.get(file.path)?.deletions,
      })),
    }))
  }),

  gitDiffFile: t.procedure
    .input(z.object({ repoPath: z.string(), filePath: z.string() }))
    .query(({ input }) => gitDiffFile(input.repoPath, input.filePath)),

  gitBranch: t.procedure.input(z.string()).query(({ input }) => gitBranch(input)),

  gitWorktrees: t.procedure.input(z.string()).query(({ input }) => gitWorktrees(input)),

  gitLog: t.procedure
    .input(z.object({ repoPath: z.string(), limit: z.number().int().max(500).default(200) }))
    .query(({ input }) => gitLog(input.repoPath, input.limit)),

  gitCommitFiles: t.procedure
    .input(z.object({ repoPath: z.string(), hash: z.string() }))
    .query(({ input }) => gitCommitFiles(input.repoPath, input.hash)),

  gitCommitDiff: t.procedure
    .input(z.object({ repoPath: z.string(), hash: z.string(), filePath: z.string() }))
    .query(({ input }) => gitCommitDiff(input.repoPath, input.hash, input.filePath)),

  searchFiles: t.procedure
    .input(z.object({ repoPath: z.string(), query: z.string() }))
    .query(async ({ input }): Promise<string[]> => {
      if (input.query.trim() === '') return []
      const [files, config] = await Promise.all([gitListFiles(input.repoPath), loadConfig()])
      const hidden = hiddenPathsFor(config, input.repoPath)
      const visible =
        hidden.size === 0
          ? files
          : files.filter((f) => {
              for (const h of hidden) {
                const rel = h.startsWith(`${input.repoPath}/`)
                  ? h.slice(input.repoPath.length + 1)
                  : h
                if (f === rel || f.startsWith(`${rel}/`)) return false
              }
              return true
            })
      return fuzzySearch(input.query, visible, 50).map((r) => r.path)
    }),

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

  appEvents: t.procedure.subscription(() =>
    observable<AppEvent>((emit) => subscribeAppEvents((event) => emit.next(event))),
  ),
})

export type AppRouter = typeof router
