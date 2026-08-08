/**
 * Paths in the Files tab come in two forms and the difference matters.
 *
 * The **daemon** speaks absolute host paths: `readDir`, `readFile`, and the scope mutations all
 * take one. **Routes, comments and this tab's own state** speak repo-relative paths, because a
 * deep link, a review comment, and a pushed screen all have to survive the repo moving on the
 * host — and because a rest route segment cannot carry a leading slash.
 *
 * Everything here converts between the two, and nothing else in the feature does.
 */

/** The repo root itself, as a relative path. Empty rather than `.` — routes concatenate it. */
export const REPO_ROOT = ''

/** Absolute host path for a repo-relative one. The root maps to the repo path itself. */
export function absolutePath(repoPath: string, relative: string): string {
  return relative === REPO_ROOT ? repoPath : `${repoPath}/${relative}`
}

/**
 * Repo-relative path for an absolute one, or `null` when the path is outside the repo.
 *
 * Refusing an outside path is deliberate: every consumer of this feature (routes, comments,
 * the pinned list) assumes repo-relative, and a daemon that answers with a symlink target or a
 * stale pin from another checkout must not be turned into a path that reads as inside.
 */
export function relativePath(repoPath: string, absolute: string): string | null {
  if (absolute === repoPath) return REPO_ROOT
  return absolute.startsWith(`${repoPath}/`) ? absolute.slice(repoPath.length + 1) : null
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
 * Rest-route segments for a repo-relative path.
 *
 * Expo Router hands `[...path]` back as an array and joins it into the URL, so the round trip
 * is only lossless if empty segments never enter it — the root pushes no route at all.
 */
export function pathSegments(relative: string): string[] {
  return relative === REPO_ROOT ? [] : relative.split('/')
}

/** The repo-relative path a `[...path]` route was opened with. */
export function pathFromSegments(segments: string[] | string | undefined): string {
  if (segments === undefined) return REPO_ROOT
  return (Array.isArray(segments) ? segments : [segments]).join('/')
}

/** A stable, resolvable per-path testID — never an array index, so the Android tree finds it. */
export function pathTestId(prefix: string, relative: string): string {
  const slug = relative
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80)
  return `${prefix}-${slug === '' ? 'root' : slug}`
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
