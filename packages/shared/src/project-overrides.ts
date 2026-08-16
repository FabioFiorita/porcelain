/** Normalize a path supplied to project hide/pin overrides. */
export function projectOverridePath(repoPath: string, value: string): string {
  const path = value.trim().replaceAll('\\', '/')
  const root = repoPath.trim().replaceAll('\\', '/').replace(/\/+$/, '')
  if (path === '') throw new Error('path must be non-empty')
  if (path === '.' || path === root) return ''
  if (path.startsWith(`${root}/`)) return path.slice(root.length + 1)
  if (path.startsWith('/')) {
    const segments = path.split('/').filter(Boolean)
    const rootSegments = root.split('/').filter(Boolean)
    const sameRoot = rootSegments.every((segment, index) => segments[index] === segment)
    const relative = sameRoot ? segments.slice(rootSegments.length) : []
    if (!sameRoot || relative.length === 0 || relative.includes('..')) {
      throw new Error(`path must be inside the repo: ${value}`)
    }
    return relative.join('/')
  }
  return path.replace(/^\.\//, '')
}
