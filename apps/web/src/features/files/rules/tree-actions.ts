import { FILE_NAME_SUFFIX_START } from '@/config/limits';

export function nextCreatePath(
  kind: 'file' | 'directory',
  folder: string,
  exists: (path: string) => boolean,
) {
  const base = kind === 'file' ? 'untitled' : 'new-folder';
  const path = (name: string) =>
    `${folder}${name}${kind === 'directory' ? '/' : ''}`;
  if (!exists(path(base))) return path(base);
  let suffix = FILE_NAME_SUFFIX_START;
  while (exists(path(`${base}-${suffix}`))) suffix += 1;
  return path(`${base}-${suffix}`);
}

export function topLevelDraggedPaths(paths: readonly string[]) {
  return paths.filter(
    (path) =>
      !paths.some(
        (parent) =>
          parent !== path && parent.endsWith('/') && path.startsWith(parent),
      ),
  );
}

export function canDropPaths(paths: readonly string[], directoryPath: string) {
  return !paths.some(
    (path) => path.endsWith('/') && directoryPath.startsWith(path),
  );
}

export function entryName(path: string) {
  return path.replace(/\/$/, '').split('/').at(-1) ?? path;
}

export function directoryPaths(paths: readonly string[]) {
  return paths.filter((path) => path.endsWith('/'));
}

export function selectedDirectories(path: string) {
  return path
    .split('/')
    .slice(0, -1)
    .map((_, index, segments) => `${segments.slice(0, index + 1).join('/')}/`);
}

export type TreeAction =
  | 'new-file'
  | 'new-folder'
  | 'rename'
  | 'open'
  | 'open-file'
  | 'open-diff'
  | 'hide'
  | 'copy-relative'
  | 'copy-full'
  | 'trash';

export function treeActions(input: {
  folder: boolean;
  link: boolean;
  changed: boolean;
  openable: boolean;
  hiddenEntry: string | null;
  ownHidden: boolean;
  hiddenName: string;
}) {
  const actions: { id: TreeAction; label: string }[] = [];
  if (input.folder && !input.link) {
    actions.push({ id: 'new-file', label: 'New file' });
    actions.push({ id: 'new-folder', label: 'New folder' });
  }
  if (!input.link) actions.push({ id: 'rename', label: 'Rename' });
  if (input.openable) {
    actions.push(
      input.changed
        ? { id: 'open-diff', label: 'Open diff' }
        : { id: 'open', label: 'Open' },
    );
    if (input.changed) actions.push({ id: 'open-file', label: 'Open file' });
  }
  actions.push({
    id: 'hide',
    label:
      input.hiddenEntry === null
        ? input.folder
          ? 'Hide folder'
          : 'Hide file'
        : input.ownHidden
          ? input.folder
            ? 'Show folder'
            : 'Show file'
          : `Show ${input.hiddenName}`,
  });
  actions.push({ id: 'copy-relative', label: 'Copy relative path' });
  actions.push({ id: 'copy-full', label: 'Copy full path' });
  actions.push({ id: 'trash', label: 'Move to trash' });
  return actions;
}
