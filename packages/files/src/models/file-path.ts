export function filePathError(
  path: string,
  directory: boolean,
): 'INVALID_REQUEST' | 'PATH_NOT_READABLE' | undefined {
  if (path === '' && directory) return;
  if (
    path.length > 4096 ||
    path.includes('\\') ||
    path.includes('\0') ||
    /^[a-z]:/i.test(path) ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  )
    return 'INVALID_REQUEST';
  if (path.split('/').some((part) => part.toLowerCase() === '.git'))
    return 'PATH_NOT_READABLE';
}
