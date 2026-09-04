/** Convert daemon-host paths to the repository-relative paths used by Files routes and comments. */

import { isFilesProjectRelativePath } from '@porcelain/contracts/files'

import { REPO_ROOT } from '@/lib/path-identities'

export { pathFromSegments, pathSegments, pathTestId, REPO_ROOT } from '@/lib/path-identities'

function normalizedRepoPath(repoPath: string): string {
  const normalized = repoPath.replaceAll('\\', '/')
  if (normalized === '/' || /^[A-Za-z]:\/$/.test(normalized)) return normalized
  return normalized.replace(/\/+$/, '')
}

/** Absolute host path for a repo-relative one. The root maps to the repo path itself. */
export function absolutePath(repoPath: string, relative: string): string {
  const root = normalizedRepoPath(repoPath)
  if (relative === REPO_ROOT) return root
  return root.endsWith('/') ? `${root}${relative}` : `${root}/${relative}`
}

/**
 * Repo-relative path for an absolute one, or `null` when the path is outside the repo.
 *
 * Refusing an outside path is deliberate: every consumer of this feature (routes, comments,
 * the pinned list) assumes repo-relative, and a daemon that answers with a symlink target or a
 * stale pin from another checkout must not be turned into a path that reads as inside.
 */
export function relativePath(repoPath: string, absolute: string): string | null {
  const root = normalizedRepoPath(repoPath)
  const candidate = normalizedRepoPath(absolute)
  if (candidate === root) return REPO_ROOT
  const prefix = root.endsWith('/') ? root : `${root}/`
  if (!candidate.startsWith(prefix)) return null
  const relative = candidate.slice(prefix.length)
  return isFilesProjectRelativePath(relative) ? relative : null
}

/** The containing directory of a repo-relative path; the root's parent is itself. */
export function parentPath(relative: string): string {
  const cut = relative.lastIndexOf('/')
  return cut === -1 ? REPO_ROOT : relative.slice(0, cut)
}

export type Crumb = {
  /** What the segment reads as — the repo name for the root, the folder name otherwise. */
  label: string
  /** The repo-relative directory this crumb navigates to. */
  path: string
}

/**
 * The breadcrumb trail for a directory, repo name first.
 *
 * The tablet renders every crumb as a target (its list column has no stack to pop); the phone
 * renders the same trail but navigates with the stack it already pushed. Both read the same
 * derivation so the two form factors can never disagree about where you are.
 */
export function breadcrumbs(repoName: string, relative: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: repoName, path: REPO_ROOT }]
  if (relative === REPO_ROOT) return crumbs
  let walked = ''
  for (const segment of relative.split('/')) {
    walked = walked === '' ? segment : `${walked}/${segment}`
    crumbs.push({ label: segment, path: walked })
  }
  return crumbs
}

/**
 * Where a "new file/folder" action long-pressed on `entry` should create it.
 *
 * Inside a folder row — pressing a folder means "in here" — and beside a file row, which has no
 * inside. Without the second half, creating from a file row would try to nest a path under a
 * file and the daemon would refuse it.
 */
export function containerFor(entry: { kind: 'dir' | 'file'; path: string }): string {
  return entry.kind === 'dir' ? entry.path : parentPath(entry.path)
}
