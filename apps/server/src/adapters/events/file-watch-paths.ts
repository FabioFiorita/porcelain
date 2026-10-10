import { relative, sep } from 'node:path';

export function fileWatchPaths(
  root: string,
  events: readonly { path: string }[],
  isTemporaryWrite: (path: string) => boolean,
): string[] | undefined {
  const paths = events.flatMap((event) => {
    const path = relative(root, event.path);
    if (path === '' || path === '..' || path.startsWith(`..${sep}`)) return [];
    const reported = path.split(sep).join('/');
    return isTemporaryWrite(reported) ? [] : [reported];
  });
  return paths.length > 0 ? paths : undefined;
}
