/** Shared repo-relative route/test identity helpers used by Files and Search surfaces. */
export const REPO_ROOT = ''

export function pathSegments(relative: string): string[] {
  return relative === REPO_ROOT ? [] : relative.split('/')
}

export function pathFromSegments(segments: string[] | string | undefined): string {
  if (segments === undefined) return REPO_ROOT
  return (Array.isArray(segments) ? segments : [segments]).join('/')
}

/** A stable, resolvable per-path testID — never an array index. */
export function pathTestId(prefix: string, relative: string): string {
  const slug = relative
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80)
  return `${prefix}-${slug === '' ? 'root' : slug}`
}
