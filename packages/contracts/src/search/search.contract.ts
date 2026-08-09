import { z } from 'zod'

export const grepMatchSchema = z
  .object({
    path: z.string(),
    line: z.number(),
    text: z.string(),
  })
  .strict()

export type GrepMatch = z.infer<typeof grepMatchSchema>

export const codeSearchLineSchema = z
  .object({
    line: z.number(),
    text: z.string(),
    match: z.boolean(),
  })
  .strict()

export type CodeSearchLine = z.infer<typeof codeSearchLineSchema>

export const codeSearchHunkSchema = z
  .object({
    lines: z.array(codeSearchLineSchema),
  })
  .strict()

export type CodeSearchHunk = z.infer<typeof codeSearchHunkSchema>

export const codeSearchFileSchema = z
  .object({
    path: z.string(),
    hunks: z.array(codeSearchHunkSchema),
    matchCount: z.number(),
  })
  .strict()

export type CodeSearchFile = z.infer<typeof codeSearchFileSchema>

export const codeSearchResultSchema = z
  .object({
    files: z.array(codeSearchFileSchema),
    truncated: z.boolean(),
  })
  .strict()

export type CodeSearchResult = z.infer<typeof codeSearchResultSchema>

export const searchResultSchema = z
  .object({
    path: z.string(),
    kind: z.enum(['file', 'dir']),
  })
  .strict()

export type SearchResult = z.infer<typeof searchResultSchema>

export const searchTextInputSchema = z
  .object({
    repoPath: z.string(),
    query: z.string().min(1),
  })
  .strict()
export const searchTextOutputSchema = z.array(grepMatchSchema)
export type SearchTextInput = z.infer<typeof searchTextInputSchema>
export type SearchTextOutput = z.infer<typeof searchTextOutputSchema>

export const searchCodeInputSchema = z
  .object({
    repoPath: z.string(),
    query: z.string().min(1),
    regex: z.boolean(),
    caseSensitive: z.boolean(),
    include: z.string(),
    exclude: z.string(),
  })
  .strict()
export const searchCodeOutputSchema = codeSearchResultSchema
export type SearchCodeInput = z.infer<typeof searchCodeInputSchema>
export type SearchCodeOutput = z.infer<typeof searchCodeOutputSchema>

export const searchFilesInputSchema = z
  .object({
    repoPath: z.string(),
    query: z.string(),
  })
  .strict()
export const searchFilesOutputSchema = z.array(searchResultSchema)
export type SearchFilesInput = z.infer<typeof searchFilesInputSchema>
export type SearchFilesOutput = z.infer<typeof searchFilesOutputSchema>

/** Representative contract-valid Search values used by boundary tests and client mocks. */
export const searchContractFixtures = {
  searchText: {
    input: { repoPath: '/synthetic/repo', query: 'needle' },
    output: [
      { path: 'src/alpha.ts', line: 3, text: 'const needle = true' },
      { path: 'README.md', line: 12, text: 'needle appears here' },
    ],
  },
  searchCode: {
    input: {
      repoPath: '/synthetic/repo',
      query: 'needle',
      regex: false,
      caseSensitive: false,
      include: 'src/**/*.ts',
      exclude: 'src/generated/**',
    },
    output: {
      files: [
        {
          path: 'src/alpha.ts',
          hunks: [
            {
              lines: [
                { line: 1, text: 'const value = 1', match: false },
                { line: 2, text: 'const needle = value', match: true },
                { line: 3, text: 'return needle', match: true },
              ],
            },
          ],
          matchCount: 2,
        },
      ],
      truncated: false,
    },
  },
  searchFiles: {
    input: { repoPath: '/synthetic/repo', query: 'src' },
    output: [
      { path: 'src', kind: 'dir' },
      { path: 'src/alpha.ts', kind: 'file' },
    ],
  },
} as const
