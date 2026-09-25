import type {
  ListFilePreferencesResponse,
  SetFilePreferenceRequest,
} from '@porcelain/contracts/projects';

export type FilePreference = ListFilePreferencesResponse['preferences'][number];
export type FilePreferencesResponse = ListFilePreferencesResponse;
export type { SetFilePreferenceRequest };

export type SetHiddenInput = { path: string; hidden: boolean };

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
    : paths.filter((path) => hiddenPathFor(path, hidden) == null);
}
