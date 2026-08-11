import { z } from 'zod'

import { defineQuery } from '../procedure'

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

export type FileSearchResult = z.infer<typeof searchResultSchema>
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
