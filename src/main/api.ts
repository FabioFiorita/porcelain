import { initTRPC } from '@trpc/server'
import { dialog } from 'electron'
import { readdir, readFile } from 'fs/promises'
import { basename, join } from 'path'
import { z } from 'zod'

const t = initTRPC.create({ isServer: true })

export interface RepoInfo {
  path: string
  name: string
}

export interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'dir'
}

export const router = t.router({
  openRepo: t.procedure.query(async (): Promise<RepoInfo | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    const path = result.filePaths[0]
    return path ? { path, name: basename(path) } : null
  }),

  readDir: t.procedure.input(z.string()).query(async ({ input }): Promise<DirEntry[]> => {
    const entries = await readdir(input, { withFileTypes: true })
    return entries
      .map(
        (entry): DirEntry => ({
          name: entry.name,
          path: join(input, entry.name),
          kind: entry.isDirectory() ? 'dir' : 'file',
        }),
      )
      .sort((a, b) =>
        a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1,
      )
  }),

  readFile: t.procedure.input(z.string()).query(({ input }) => readFile(input, 'utf8')),
})

export type AppRouter = typeof router
