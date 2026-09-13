import type { FileTreeDirectoryHandle, GitStatusEntry } from '@pierre/trees';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { useEffect, useRef } from 'react';

export function PierreFileTree({
  paths,
  gitStatus,
  selected,
  onExpand,
  onSelect,
}: {
  paths: readonly string[];
  gitStatus: readonly GitStatusEntry[];
  selected: string;
  onExpand: (paths: readonly string[]) => void;
  onSelect: (path: string) => void;
}) {
  const latest = useRef({ paths, gitStatus, selected, onExpand, onSelect });
  const reveal = useRef({ selected: '', complete: false });
  latest.current = { paths, gitStatus, selected, onExpand, onSelect };
  const { model } = useFileTree({
    paths,
    density: 'compact',
    flattenEmptyDirectories: false,
    initialExpansion: 'closed',
    icons: 'complete',
    gitStatus,
    search: false,
    onSelectionChange: ([path]) => {
      if (path && path !== latest.current.selected)
        latest.current.onSelect(path);
    },
  });

  useEffect(() => {
    if (reveal.current.selected !== selected)
      reveal.current = { selected, complete: false };
    const expanded = directoryPaths(latest.current.paths).filter((path) => {
      const item = model.getItem(path);
      if (!item?.isDirectory()) return false;
      return (item as FileTreeDirectoryHandle).isExpanded();
    });
    model.resetPaths(paths);
    const revealPaths = reveal.current.complete
      ? []
      : selectedDirectories(selected);
    for (const path of [...expanded, ...revealPaths]) {
      const item = model.getItem(path);
      if (item?.isDirectory()) (item as FileTreeDirectoryHandle).expand();
    }
    const selectedItem = model.getItem(selected);
    if (selectedItem && !selectedItem.isDirectory()) {
      selectedItem.select();
      reveal.current.complete = true;
    }
  }, [model, paths, selected]);

  useEffect(() => model.setGitStatus(gitStatus), [model, gitStatus]);

  useEffect(
    () =>
      model.subscribe(() => {
        const expanded = directoryPaths(latest.current.paths)
          .filter((path) => {
            const item = model.getItem(path);
            if (!item?.isDirectory()) return false;
            return (item as FileTreeDirectoryHandle).isExpanded();
          })
          .map((path) => path.replace(/\/$/, ''));
        if (expanded.length) latest.current.onExpand(expanded);
      }),
    [model],
  );

  return (
    <FileTree
      model={model}
      data-slot="file-tree"
      aria-label="Worktree files"
      className="min-h-0 flex-1"
    />
  );
}

function directoryPaths(paths: readonly string[]) {
  return paths.filter((path) => path.endsWith('/'));
}

function selectedDirectories(path: string) {
  return path
    .split('/')
    .slice(0, -1)
    .map((_, index, segments) => `${segments.slice(0, index + 1).join('/')}/`);
}
