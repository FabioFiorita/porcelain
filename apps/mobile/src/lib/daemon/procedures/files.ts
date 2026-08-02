import { z } from 'zod'

import { defineMutation, defineQuery } from '../procedure'

const dirEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.enum(['file', 'dir']),
  hidden: z.boolean(),
  pinned: z.boolean(),
})

const searchResultSchema = z.object({
  path: z.string(),
  kind: z.enum(['file', 'dir']),
})

const fileViewSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({ type: z.literal('image'), dataUrl: z.string() }),
  z.object({ type: z.literal('binary'), size: z.number() }),
  z.object({ type: z.literal('too-large'), size: z.number() }),
  z.object({ type: z.literal('not-found') }),
])

export type DirEntry = z.infer<typeof dirEntrySchema>
export type FileSearchResult = z.infer<typeof searchResultSchema>
export type FileView = z.infer<typeof fileViewSchema>

export const readDirQuery = defineQuery<
  { repoPath: string; path: string; showHidden: boolean },
  DirEntry[]
>('readDir', z.array(dirEntrySchema))

export const pinnedEntriesQuery = defineQuery<string, DirEntry[]>(
  'pinnedEntries',
  z.array(dirEntrySchema),
)

export const searchFilesQuery = defineQuery<
  { repoPath: string; query: string },
  FileSearchResult[]
>('searchFiles', z.array(searchResultSchema))

export const readFileQuery = defineQuery<string, FileView>('readFile', fileViewSchema)

type ScopeInput = { repoPath: string; path: string }

export const hidePathMutation = defineMutation<ScopeInput, void>('hidePath', z.void())
export const unhidePathMutation = defineMutation<ScopeInput, void>('unhidePath', z.void())
export const pinPathMutation = defineMutation<ScopeInput, void>('pinPath', z.void())
export const unpinPathMutation = defineMutation<ScopeInput, void>('unpinPath', z.void())
