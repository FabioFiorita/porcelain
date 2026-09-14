import type { FileTreeDirectoryHandle, GitStatusEntry } from '@pierre/trees';
import { FileTree, useFileTree } from '@pierre/trees/react';
import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  FileCodeIcon,
  FileDiffIcon,
} from 'lucide-react';
import { Fragment, useEffect, useRef } from 'react';
import {
  canonicalPreferencePath,
  hiddenPathFor,
} from '../../domain/file-preferences';
import { copyText } from '../workspace/copy';

export function PierreFileTree({
  paths,
  gitStatus,
  selected,
  hidden,
  changed,
  openable,
  worktreePath,
  onExpand,
  onSelect,
  onOpenFile,
  onSetHidden,
}: {
  paths: readonly string[];
  gitStatus: readonly GitStatusEntry[];
  selected: string;
  hidden: ReadonlySet<string>;
  changed: ReadonlySet<string>;
  openable: ReadonlySet<string>;
  worktreePath: string;
  onExpand: (paths: readonly string[]) => void;
  onSelect: (path: string) => void;
  onOpenFile: (path: string) => void;
  onSetHidden: (path: string, hidden: boolean) => void;
}) {
  const latest = useRef({
    paths,
    gitStatus,
    selected,
    hidden,
    changed,
    openable,
    worktreePath,
    onExpand,
    onSelect,
    onOpenFile,
    onSetHidden,
  });
  const reveal = useRef({ selected: '', complete: false });
  latest.current = {
    paths,
    gitStatus,
    selected,
    hidden,
    changed,
    openable,
    worktreePath,
    onExpand,
    onSelect,
    onOpenFile,
    onSetHidden,
  };
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
      renderContextMenu={(item, context) => {
        const folder = item.kind === 'directory';
        const path =
          folder && !item.path.endsWith('/') ? `${item.path}/` : item.path;
        const hiddenEntry = hiddenPathFor(path, latest.current.hidden);
        const changed = latest.current.changed.has(path);
        const openable = latest.current.openable.has(path);
        const actions = [
          ...(openable
            ? [
                {
                  label: changed ? 'Open diff' : 'Open',
                  icon: changed ? FileDiffIcon : FileCodeIcon,
                  run: () => latest.current.onSelect(path),
                },
                ...(changed
                  ? [
                      {
                        label: 'Open file',
                        icon: FileCodeIcon,
                        run: () => latest.current.onOpenFile(path),
                      },
                    ]
                  : []),
                'separator-open' as const,
              ]
            : []),
          {
            label:
              hiddenEntry == null
                ? folder
                  ? 'Hide folder'
                  : 'Hide file'
                : hiddenEntry === canonicalPreferencePath(path)
                  ? folder
                    ? 'Show folder'
                    : 'Show file'
                  : `Show ${entryName(hiddenEntry)}`,
            icon: hiddenEntry == null ? EyeOffIcon : EyeIcon,
            run: () =>
              latest.current.onSetHidden(
                hiddenEntry ?? path,
                hiddenEntry == null,
              ),
          },
          'separator-hide' as const,
          {
            label: 'Copy relative path',
            icon: CopyIcon,
            run: () => copyText(path, 'relative path'),
          },
          {
            label: 'Copy full path',
            icon: CopyIcon,
            run: () =>
              copyText(
                `${latest.current.worktreePath.replace(/\/$/, '')}/${path}`,
                'full path',
              ),
          },
        ];
        return (
          <div
            role="menu"
            ref={(menu) => prepareMenu(menu, context.anchorRect)}
            onKeyDown={(event) => {
              const items = menuItems(event.currentTarget);
              const current = items.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                items[(current + 1) % items.length]?.focus();
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                items[(current - 1 + items.length) % items.length]?.focus();
              } else if (event.key === 'Home') {
                event.preventDefault();
                items[0]?.focus();
              } else if (event.key === 'End') {
                event.preventDefault();
                items.at(-1)?.focus();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                context.close({ restoreFocus: true });
              }
            }}
            style={{
              position: 'fixed',
              top: context.anchorRect.bottom + 4,
              left: context.anchorRect.left,
            }}
            className="z-50 min-w-48 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            {actions.map((action) =>
              typeof action === 'string' ? (
                <hr key={action} className="-mx-1 my-1 border-border" />
              ) : (
                <Fragment key={action.label}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      context.close({ restoreFocus: true });
                      action.run();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-accent"
                  >
                    <action.icon className="size-3.5 text-muted-foreground" />
                    {action.label}
                  </button>
                </Fragment>
              ),
            )}
          </div>
        );
      }}
    />
  );
}

function entryName(path: string) {
  return path.replace(/\/$/, '').split('/').at(-1) ?? path;
}

function prepareMenu(
  element: HTMLDivElement | null,
  anchor: Readonly<Pick<DOMRect, 'left' | 'bottom'>>,
) {
  if (!element) return;
  requestAnimationFrame(() => {
    const bounds = element.getBoundingClientRect();
    const gutter = 8;
    element.style.left = `${Math.max(gutter, Math.min(anchor.left, window.innerWidth - bounds.width - gutter))}px`;
    element.style.top = `${Math.max(gutter, Math.min(anchor.bottom + 4, window.innerHeight - bounds.height - gutter))}px`;
    menuItems(element)[0]?.focus();
  });
}

function menuItems(menu: HTMLElement) {
  return [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
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
