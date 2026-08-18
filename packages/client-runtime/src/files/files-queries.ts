import {
  filesProjectPathSchema,
  filesProjectRelativePathSchema,
  isFilesProjectPath,
  isFilesProjectRelativePath,
} from '@porcelain/contracts/files'
import { z } from 'zod'

/**
 * Programmer error for invalid project or identity paths.
 * Not a domain public error; never mapped to contracts error codes.
 */
export class FilesIdentityError extends Error {
  override readonly name = 'FilesIdentityError'
}

/**
 * Normalize absolute project root for identity / effect / interest dimensions.
 * 1. Empty string → throw non-empty message (distinct from other invalid input).
 * 2. Else validate with landed `isFilesProjectPath` (NUL, backslash, length ≤ 4096,
 *    must start with `/` — same rules as the wire schema).
 * 3. On pass, strip trailing `/` except root `/` itself — same trailing-slash behavior as
 *    Web `normalizeProjectRoot`. No extra dot-segment or host canonicalization here;
 *    daemon/session owns canonical host resolution.
 */
export function filesProjectKey(projectPath: string): string {
  if (projectPath === '') {
    throw new FilesIdentityError('files: project path must be non-empty')
  }
  if (!isFilesProjectPath(projectPath)) {
    throw new FilesIdentityError('files: project path must be absolute')
  }
  const trimmed = projectPath.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/**
 * Runtime identity schemas (foundation Zod repair).
 *
 * A React Query cache key is generic `unknown[]` at every predicate, so an adapter that
 * only pattern-matched `domain`/`name` was trusting a shape it never parsed. These strict
 * schemas are the single executable description of the five Files identities; the exported
 * types are inferred from them and the constructors below still own normalization.
 *
 * `projectPath` reuses the wire `filesProjectPathSchema` because `filesProjectKey` already
 * produces exactly that vocabulary. Tree paths additionally admit `'.'` (project root),
 * which is the one identity path with no project-relative spelling.
 */
const filesTreePathSchema = z.union([z.literal('.'), filesProjectRelativePathSchema])

export const filesTreeQuerySchema = z
  .object({
    domain: z.literal('files'),
    name: z.literal('tree'),
    projectPath: filesProjectPathSchema,
    path: filesTreePathSchema,
    showHidden: z.boolean(),
  })
  .strict()

export const filesPinsQuerySchema = z
  .object({
    domain: z.literal('files'),
    name: z.literal('pins'),
    projectPath: filesProjectPathSchema,
  })
  .strict()

export const filesScopeQuerySchema = z
  .object({
    domain: z.literal('files'),
    name: z.literal('scope'),
    projectPath: filesProjectPathSchema,
  })
  .strict()

/**
 * The same two levels `scope` merges, kept apart. Settings → Personalization is
 * the reader: it has to say which focus is the project baseline and which this
 * worktree added, and the merged `scope` cannot answer that.
 */
export const filesProfileQuerySchema = z
  .object({
    domain: z.literal('files'),
    name: z.literal('profile'),
    projectPath: filesProjectPathSchema,
  })
  .strict()

export const fileContentQuerySchema = z
  .object({
    domain: z.literal('files'),
    name: z.literal('content'),
    projectPath: filesProjectPathSchema,
    path: filesProjectRelativePathSchema,
  })
  .strict()

export const filePreviewQuerySchema = z
  .object({
    domain: z.literal('files'),
    name: z.literal('preview'),
    projectPath: filesProjectPathSchema,
    path: filesProjectRelativePathSchema,
  })
  .strict()

/** Any Files server-state identity, discriminated by `name`. */
export const filesQuerySchema = z.discriminatedUnion('name', [
  filesTreeQuerySchema,
  filesPinsQuerySchema,
  filesScopeQuerySchema,
  filesProfileQuerySchema,
  fileContentQuerySchema,
  filePreviewQuerySchema,
])

export type FilesTreeQuery = Readonly<z.infer<typeof filesTreeQuerySchema>>
export type FilesPinsQuery = Readonly<z.infer<typeof filesPinsQuerySchema>>
export type FilesScopeQuery = Readonly<z.infer<typeof filesScopeQuerySchema>>
export type FilesProfileQuery = Readonly<z.infer<typeof filesProfileQuerySchema>>
export type FileContentQuery = Readonly<z.infer<typeof fileContentQuerySchema>>
export type FilePreviewQuery = Readonly<z.infer<typeof filePreviewQuerySchema>>
export type FilesQuery = Readonly<z.infer<typeof filesQuerySchema>>

export function filesTreeQuery(
  projectPath: string,
  path: string,
  showHidden: boolean,
): FilesTreeQuery {
  const key = filesProjectKey(projectPath)
  if (path !== '.' && !isFilesProjectRelativePath(path)) {
    throw new FilesIdentityError('files: invalid tree path')
  }
  return {
    domain: 'files',
    name: 'tree',
    projectPath: key,
    path,
    showHidden,
  }
}

export function filesPinsQuery(projectPath: string): FilesPinsQuery {
  return {
    domain: 'files',
    name: 'pins',
    projectPath: filesProjectKey(projectPath),
  }
}

export function filesScopeQuery(projectPath: string): FilesScopeQuery {
  return {
    domain: 'files',
    name: 'scope',
    projectPath: filesProjectKey(projectPath),
  }
}

export function filesProfileQuery(projectPath: string): FilesProfileQuery {
  return {
    domain: 'files',
    name: 'profile',
    projectPath: filesProjectKey(projectPath),
  }
}

export function fileContentQuery(projectPath: string, path: string): FileContentQuery {
  const key = filesProjectKey(projectPath)
  if (!isFilesProjectRelativePath(path)) {
    throw new FilesIdentityError('files: invalid content path')
  }
  return {
    domain: 'files',
    name: 'content',
    projectPath: key,
    path,
  }
}

export function filePreviewQuery(projectPath: string, path: string): FilePreviewQuery {
  const key = filesProjectKey(projectPath)
  if (!isFilesProjectRelativePath(path)) {
    throw new FilesIdentityError('files: invalid content path')
  }
  return {
    domain: 'files',
    name: 'preview',
    projectPath: key,
    path,
  }
}

/** Parent of a Files identity/notification path. `'.'` has no parent → null. Bare segment → `'.'`. */
export function parentFilesPath(path: string): string | null {
  if (path === '.') return null
  const slash = path.lastIndexOf('/')
  if (slash === -1) return '.'
  return path.slice(0, slash)
}

/**
 * Tree path keys made stale by a structural path without knowing file vs directory:
 * `[path]` plus parent when defined. Dedup preserving first-seen order.
 */
export function filesTreePathsAffectedBy(path: string): readonly string[] {
  const parent = parentFilesPath(path)
  if (parent === null) return [path]
  return [path, parent]
}

export function isFilesTreeQuery(value: FilesQuery): value is FilesTreeQuery {
  return value.name === 'tree'
}

export function isFileContentQuery(value: FilesQuery): value is FileContentQuery {
  return value.name === 'content'
}

export function isFilePreviewQuery(value: FilesQuery): value is FilePreviewQuery {
  return value.name === 'preview'
}
