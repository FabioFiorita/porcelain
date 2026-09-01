/** Normalize a path supplied to project hide/pin overrides. */
export function projectOverridePath(repoPath: string, value: string): string {
  const path = value.trim().replaceAll('\\', '/')
  const trimmedRoot = repoPath.trim().replaceAll('\\', '/').replace(/\/+$/, '')
  const root = trimmedRoot === '' ? '/' : trimmedRoot
  if (path === '') throw new Error('path must be non-empty')
  if (path === '.' || path === root) return ''
  let relative = path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path
  if (path.startsWith('/')) {
    const segments = path.split('/').filter(Boolean)
    const rootSegments = root.split('/').filter(Boolean)
    const sameRoot = rootSegments.every((segment, index) => segments[index] === segment)
    const relativeSegments = sameRoot ? segments.slice(rootSegments.length) : []
    if (!sameRoot || relativeSegments.length === 0) {
      throw new Error(`path must be inside the repo: ${value}`)
    }
    relative = relativeSegments.join('/')
  }
  relative = relative.replace(/^\.\//, '')
  const segments = relative.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`path must be a normalized path inside the repo: ${value}`)
  }
  return relative
}
