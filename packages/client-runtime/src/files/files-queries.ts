import { isFilesProjectPath, isFilesProjectRelativePath } from '@porcelain/contracts/files'

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

export type FilesTreeQuery = {
  readonly domain: 'files'
  readonly name: 'tree'
  readonly projectPath: string
  readonly path: string
  readonly showHidden: boolean
}

export type FilesPinsQuery = {
  readonly domain: 'files'
  readonly name: 'pins'
  readonly projectPath: string
}

export type FilesScopeQuery = {
  readonly domain: 'files'
  readonly name: 'scope'
  readonly projectPath: string
}

export type FileContentQuery = {
  readonly domain: 'files'
  readonly name: 'content'
  readonly projectPath: string
  readonly path: string
}

export type FilePreviewQuery = {
  readonly domain: 'files'
  readonly name: 'preview'
  readonly projectPath: string
  readonly path: string
}

export type FilesQuery =
  | FilesTreeQuery
  | FilesPinsQuery
  | FilesScopeQuery
  | FileContentQuery
  | FilePreviewQuery

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
