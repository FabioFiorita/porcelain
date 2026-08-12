import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { procedureCatalog } from '@porcelain/contracts'
import type { DirEntry } from '@porcelain/contracts/files'
import {
  hiddenPathsForRepo,
  hidePath as hideScopePath,
  pinnedPathsForRepo,
  pinPath as pinScopePath,
  unhidePath as unhideScopePath,
  unpinPath as unpinScopePath,
} from '../stores/scope-store'
import { publicProcedure, t } from '../trpc'

export function createReposRouter() {
  return t.router({
    readDir: publicProcedure
      .input(procedureCatalog.readDir.input)
      .output(procedureCatalog.readDir.output)
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
      .input(procedureCatalog.hidePath.input)
      .output(procedureCatalog.hidePath.output)
      .mutation(async ({ input }) => {
        await hideScopePath(input.repoPath, input.path)
      }),

    unhidePath: publicProcedure
      .input(procedureCatalog.unhidePath.input)
      .output(procedureCatalog.unhidePath.output)
      .mutation(async ({ input }) => {
        await unhideScopePath(input.repoPath, input.path)
      }),

    pinPath: publicProcedure
      .input(procedureCatalog.pinPath.input)
      .output(procedureCatalog.pinPath.output)
      .mutation(async ({ input }) => {
        await pinScopePath(input.repoPath, input.path)
      }),

    unpinPath: publicProcedure
      .input(procedureCatalog.unpinPath.input)
      .output(procedureCatalog.unpinPath.output)
      .mutation(async ({ input }) => {
        await unpinScopePath(input.repoPath, input.path)
      }),

    pinnedEntries: publicProcedure
      .input(procedureCatalog.pinnedEntries.input)
      .output(procedureCatalog.pinnedEntries.output)
      .query(async ({ input }): Promise<DirEntry[]> => {
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
}
