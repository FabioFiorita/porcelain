export function relativeTo(repoPath: string | undefined, path: string): string {
  if (repoPath === undefined) return path
  const next = path.at(repoPath.length)
  return path.startsWith(repoPath) && (next === '/' || next === '\\')
    ? path.slice(repoPath.length + 1)
    : path
}

function lastSeparator(path: string): number {
  return Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
}

/** The last path segment across daemon-native POSIX and Windows paths. */
export function fileName(path: string): string {
  const i = lastSeparator(path)
  return i === -1 ? path : path.slice(i + 1)
}

/** Everything before the last separator across daemon-native POSIX and Windows paths. */
export function dirName(path: string): string {
  const i = lastSeparator(path)
  return i === -1 ? '' : path.slice(0, i)
}
