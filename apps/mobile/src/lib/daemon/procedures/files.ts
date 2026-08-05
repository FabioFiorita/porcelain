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

/** One `git grep -n` hit: repo-relative path, 1-based line, and the raw line. */
const grepMatchSchema = z.object({
  path: z.string(),
  line: z.number(),
  text: z.string(),
})

/** A line inside a code-search hunk. `match` separates a hit from its surrounding context. */
const codeSearchLineSchema = z.object({
  line: z.number(),
  text: z.string(),
  match: z.boolean(),
})

const codeSearchFileSchema = z.object({
  path: z.string(),
  hunks: z.array(z.object({ lines: z.array(codeSearchLineSchema) })),
  /** Matched lines across every hunk — context excluded. */
  matchCount: z.number(),
})

/** `truncated` is the daemon saying whole files were dropped to stay under its match cap. */
const codeSearchResultSchema = z.object({
  files: z.array(codeSearchFileSchema),
  truncated: z.boolean(),
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
export type GrepMatch = z.infer<typeof grepMatchSchema>
export type CodeSearchLine = z.infer<typeof codeSearchLineSchema>
export type CodeSearchFile = z.infer<typeof codeSearchFileSchema>
export type CodeSearchResult = z.infer<typeof codeSearchResultSchema>

/** Everything `searchCode` narrows on, minus the repo — what the Search face's controls set. */
export type CodeSearchOptions = {
  query: string
  /** Extended regular expression (`-E`) rather than a literal (`-F`). */
  regex: boolean
  caseSensitive: boolean
  /** Comma-separated git pathspec globs. `''` means no restriction. */
  include: string
  exclude: string
}

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

/** Literal repo-wide grep — flat matches, no context. The daemon caps the match count. */
export const searchTextQuery = defineQuery<{ repoPath: string; query: string }, GrepMatch[]>(
  'searchText',
  z.array(grepMatchSchema),
)

/**
 * The Search face's real read: literal or regex, case-sensitive or not, narrowed by include and
 * exclude globs, answered as per-file context hunks rather than flat lines.
 */
export const searchCodeQuery = defineQuery<
  CodeSearchOptions & { repoPath: string },
  CodeSearchResult
>('searchCode', codeSearchResultSchema)

export const readFileQuery = defineQuery<string, FileView>('readFile', fileViewSchema)

/** Sandboxed HTML preview with local images inlined as data URIs (daemon-side). */
export const previewHtmlQuery = defineQuery<string, string | null>(
  'previewHtml',
  z.string().nullable(),
)

type ScopeInput = { repoPath: string; path: string }

export const hidePathMutation = defineMutation<ScopeInput, void>('hidePath', z.void())
export const unhidePathMutation = defineMutation<ScopeInput, void>('unhidePath', z.void())
export const pinPathMutation = defineMutation<ScopeInput, void>('pinPath', z.void())
export const unpinPathMutation = defineMutation<ScopeInput, void>('unpinPath', z.void())

/**
 * The working-tree writes, all on absolute host paths.
 *
 * Each one refuses rather than clobbers: `createFile` opens with `wx`, `createFolder` is a
 * non-recursive `mkdir`, and `renamePath` checks the target first because POSIX `rename`
 * overwrites. The daemon's message is the one worth showing — none of these are swallowed.
 */
export const createFileMutation = defineMutation<{ path: string }, void>('createFile', z.void())
export const createFolderMutation = defineMutation<{ path: string }, void>('createFolder', z.void())
export const renamePathMutation = defineMutation<{ from: string; to: string }, void>(
  'renamePath',
  z.void(),
)
/** Answers the free "… copy" sibling it wrote, so the caller can reveal it. */
export const duplicatePathMutation = defineMutation<{ path: string }, string>(
  'duplicatePath',
  z.string(),
)
/** The OS trash, not `rm` — recoverable, which is why the confirmation says "Trash". */
export const trashPathMutation = defineMutation<string, void>('trashPath', z.void())
export const writeTextFileMutation = defineMutation<{ path: string; content: string }, void>(
  'writeTextFile',
  z.void(),
)
