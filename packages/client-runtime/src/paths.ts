export function relativeTo(repoPath: string | undefined, path: string): string {
  return repoPath && path.startsWith(`${repoPath}/`) ? path.slice(repoPath.length + 1) : path
}

/** The last path segment (basename). `fileName('a/b/c.ts') === 'c.ts'`; no slash → the input. */
export function fileName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

/** Everything before the last slash (dirname). `dirName('a/b/c.ts') === 'a/b'`; no slash → ''. */
export function dirName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}
