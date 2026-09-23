export function parentFolder(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  if (trimmed === '') return '/';
  const separator = trimmed.lastIndexOf('/');
  if (separator === -1) return '.';
  if (separator === 0) return '/';
  return trimmed.slice(0, separator);
}
