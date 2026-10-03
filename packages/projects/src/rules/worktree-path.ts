export function absolutePath(path: string): string | undefined {
  if (!path.startsWith('/') || path.includes('\0')) return undefined;
  const parts = path
    .split('/')
    .filter((part) => part !== '' && part !== '.')
    .reduce<string[]>(
      (kept, part) => (part === '..' ? kept.slice(0, -1) : [...kept, part]),
      [],
    );
  return `/${parts.join('/')}`;
}

export function containsPath(root: string, path: string): boolean {
  return path === root || path.startsWith(root === '/' ? root : `${root}/`);
}
