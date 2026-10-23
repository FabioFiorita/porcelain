export type SetHiddenInput = { path: string; hidden: boolean };
export type SetPinnedInput = { path: string; pinned: boolean };

export function canonicalPreferencePath(path: string) {
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

export function hiddenPathFor(
  path: string,
  hidden: ReadonlySet<string>,
): string | null {
  if (hidden.has(path)) return path;
  for (const entry of hidden) {
    if (path.startsWith(`${entry}/`)) return entry;
  }
  return null;
}

export function visibleFileTreePaths(
  paths: readonly string[],
  hidden: ReadonlySet<string>,
  showHidden: boolean,
) {
  return showHidden
    ? paths
    : paths.filter((path) => hiddenPathFor(path, hidden) === null);
}

export function hiddenSummary(
  hidden: ReadonlySet<string>,
  kindOf: (path: string) => string | undefined,
): string {
  const kinds = [...hidden].map(kindOf);
  const noun = kinds.every((kind) => kind === 'directory')
    ? 'folder'
    : kinds.every((kind) => kind === 'file')
      ? 'file'
      : 'item';
  return `${hidden.size} hidden ${noun}${hidden.size === 1 ? '' : 's'}`;
}
