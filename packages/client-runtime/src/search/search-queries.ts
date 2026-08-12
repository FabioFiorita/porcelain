import type { SearchCodeInput } from '@porcelain/contracts/search'
import { z } from 'zod'

/** Programmer error for an invalid Search project or identity value. */
export class SearchIdentityError extends Error {
  override readonly name = 'SearchIdentityError'
}

const projectPathSchema = z.string().min(1)
const searchQueryValueSchema = z.string()

/** Normalize the project dimension shared by every Search identity. */
export function searchProjectKey(projectPath: string): string {
  const parsed = projectPathSchema.safeParse(projectPath)
  if (!parsed.success) throw new SearchIdentityError('search: project path must be non-empty')
  return parsed.data
}

const searchFilesQuerySchema = z
  .object({
    domain: z.literal('search'),
    name: z.literal('files'),
    projectPath: projectPathSchema,
    query: searchQueryValueSchema,
  })
  .strict()

const searchTextQuerySchema = z
  .object({
    domain: z.literal('search'),
    name: z.literal('text'),
    projectPath: projectPathSchema,
    query: searchQueryValueSchema,
  })
  .strict()

const searchCodeQuerySchema = z
  .object({
    domain: z.literal('search'),
    name: z.literal('code'),
    projectPath: projectPathSchema,
    query: searchQueryValueSchema,
    regex: z.boolean(),
    caseSensitive: z.boolean(),
    include: z.string(),
    exclude: z.string(),
  })
  .strict()

/** Any Search server-state identity. */
export const searchQuerySchema = z.discriminatedUnion('name', [
  searchFilesQuerySchema,
  searchTextQuerySchema,
  searchCodeQuerySchema,
])

export type SearchFilesQuery = Readonly<z.infer<typeof searchFilesQuerySchema>>
export type SearchTextQuery = Readonly<z.infer<typeof searchTextQuerySchema>>
export type SearchCodeQuery = Readonly<z.infer<typeof searchCodeQuerySchema>>
export type SearchQuery = Readonly<z.infer<typeof searchQuerySchema>>
export type SearchCodeOptions = Readonly<Omit<SearchCodeInput, 'repoPath'>>

function normalizedQuery(query: string): string {
  return query.trim()
}

export function fileSearchQuery(projectPath: string, query: string): SearchFilesQuery {
  return {
    domain: 'search',
    name: 'files',
    projectPath: searchProjectKey(projectPath),
    query: normalizedQuery(query),
  }
}

export function textSearchQuery(projectPath: string, query: string): SearchTextQuery {
  return {
    domain: 'search',
    name: 'text',
    projectPath: searchProjectKey(projectPath),
    query: normalizedQuery(query),
  }
}

export function codeSearchQuery(projectPath: string, options: SearchCodeOptions): SearchCodeQuery {
  return {
    caseSensitive: options.caseSensitive,
    domain: 'search',
    exclude: options.exclude,
    include: options.include,
    name: 'code',
    projectPath: searchProjectKey(projectPath),
    query: normalizedQuery(options.query),
    regex: options.regex,
  }
}
