import type { FileTreeDirectoryHandle, GitStatusEntry } from '@pierre/trees';
import { FileTree, useFileTree } from '@pierre/trees/react';
import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  FileCodeIcon,
  FileDiffIcon,
  FilePlusIcon,
  FolderPlusIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  canonicalPreferencePath,
  hiddenPathFor,
} from '../../domain/file-preferences';
import { copyText } from '../workspace/copy';
import { treeIconsFor } from './file-icons';

export function PierreFileTree({
  paths,
  links,
  creating,
  onStartCreate,
  onCreate,
  onMove,
  onTrash,
  gitStatus,
  selected,
  hidden,
  changed,
  openable,
  worktreePath,
  onExpand,
  onSelect,
  onOpenFile,
  onOpenDiff,
  onSetHidden,
}: {
  paths: readonly string[];
  links: readonly { path: string; kind: string; target?: string | undefined }[];
  creating?:
    | { kind: 'file' | 'directory'; folder: string; nonce: number }
    | undefined;
  onStartCreate: (kind: 'file' | 'directory', folder: string) => void;
  onCreate: (path: string, kind: 'file' | 'directory') => Promise<void>;
  onMove: (from: string, to: string) => Promise<void>;
  onTrash: (path: string) => void;
  gitStatus: readonly GitStatusEntry[];
  selected: string;
  hidden: ReadonlySet<string>;
  changed: ReadonlySet<string>;
  openable: ReadonlySet<string>;
  worktreePath: string;
  onExpand: (paths: readonly string[]) => void;
  onSelect: (path: string) => void;
  onOpenFile: (path: string) => void;
  onOpenDiff: (path: string) => void;
  onSetHidden: (path: string, hidden: boolean) => void;
}) {
  // The tree model keeps the callbacks it was built with, so they read the
  // current props through this ref instead of rebuilding the model.
  const current = {
    paths,
    links,
    onStartCreate,
    onCreate,
    onMove,
    onTrash,
    gitStatus,
    selected,
    hidden,
    changed,
    openable,
    worktreePath,
    onExpand,
    onSelect,
    onOpenFile,
    onOpenDiff,
    onSetHidden,
  };
  const latest = useRef(current);
  useLayoutEffect(() => {
    latest.current = current;
  });
  const reveal = useRef({ selected: '', complete: false });
  const modelRef = useRef<ReturnType<typeof useFileTree>['model'] | null>(null);
  const syncing = useRef(false);
  const pendingCreate = useRef<{
    path: string;
    kind: 'file' | 'directory';
  } | null>(null);
  const { model } = useFileTree({
    paths,
    density: 'compact',
    flattenEmptyDirectories: true,
    initialExpansion: 'closed',
    icons: treeIconsFor(links),
    unsafeCSS:
      '[data-icon-name="file-tree-icon-chevron"] { color: var(--trees-fg-muted); }',
    gitStatus,
    search: true,
    renaming: {
      onError: (error) => {
        pendingCreate.current = null;
        toast.add({ title: 'Invalid name', description: error, type: 'error' });
        queueMicrotask(() =>
          modelRef.current?.resetPaths(latest.current.paths),
        );
      },
      onRename: (event) => {
        const pending = pendingCreate.current;
        pendingCreate.current = null;
        const operation =
          pending?.path.replace(/\/$/, '') ===
          event.sourcePath.replace(/\/$/, '')
            ? latest.current.onCreate(event.destinationPath, pending.kind)
            : latest.current.onMove(event.sourcePath, event.destinationPath);
        void operation.catch(() =>
          modelRef.current?.resetPaths(latest.current.paths),
        );
      },
    },
    dragAndDrop: {
      canDrop: ({ draggedPaths, target }) =>
        !draggedPaths.some(
          (path) =>
            path.endsWith('/') && (target.directoryPath ?? '').startsWith(path),
        ),
      onDropComplete: (event) => {
        const paths = event.draggedPaths.filter(
          (path) =>
            !event.draggedPaths.some(
              (parent) =>
                parent !== path &&
                parent.endsWith('/') &&
                path.startsWith(parent),
            ),
        );
        void paths
          .reduce<Promise<void>>(
            (previous, from) =>
              previous.then(async () => {
                const to = `${event.target.directoryPath ?? ''}${entryName(from)}`;
                if (from.replace(/\/$/, '') !== to.replace(/\/$/, ''))
                  await latest.current.onMove(from, to);
              }),
            Promise.resolve(),
          )
          .catch(() => modelRef.current?.resetPaths(latest.current.paths));
      },
    },
    renderRowDecoration: ({ item }) => {
      const link = latest.current.links.find(
        (entry) => entry.path === item.path,
      );
      return link
        ? {
            text:
              link.kind === 'symlink' ? `→ ${link.target ?? '?'}` : 'submodule',
            title: 'Not followed',
          }
        : null;
    },
    onSelectionChange: ([path]) => {
      if (
        !syncing.current &&
        path &&
        pendingCreate.current?.path.replace(/\/$/, '') !==
          path.replace(/\/$/, '') &&
        path !== latest.current.selected
      )
        latest.current.onSelect(path);
    },
  });

  useLayoutEffect(() => {
    modelRef.current = model;
  }, [model]);
  const handledCreate = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!creating || handledCreate.current === creating.nonce) return;
    handledCreate.current = creating.nonce;
    const base = creating.kind === 'file' ? 'untitled' : 'new-folder';
    let name = base;
    for (
      let index = 2;
      model.getItem(
        `${creating.folder}${name}${creating.kind === 'directory' ? '/' : ''}`,
      );
      index++
    )
      name = `${base}-${index}`;
    const path = `${creating.folder}${name}${creating.kind === 'directory' ? '/' : ''}`;
    pendingCreate.current = { path, kind: creating.kind };
    model.add(path);
    if (!model.startRenaming(path, { removeIfCanceled: true })) {
      model.remove(path, { recursive: creating.kind === 'directory' });
      pendingCreate.current = null;
    }
  }, [creating, model]);

  useEffect(() => {
    if (reveal.current.selected !== selected)
      reveal.current = { selected, complete: false };
    const expanded = directoryPaths(latest.current.paths).filter((path) => {
      const item = model.getItem(path);
      if (!item?.isDirectory()) return false;
      return (item as FileTreeDirectoryHandle).isExpanded();
    });
    syncing.current = true;
    try {
      const revealPaths = reveal.current.complete
        ? []
        : selectedDirectories(selected);
      model.resetPaths(paths, {
        initialExpandedPaths: [
          ...new Set([
            ...expanded.filter((path) =>
              selectedDirectories(path.replace(/\/$/, '')).every((parent) =>
                expanded.includes(parent),
              ),
            ),
            ...revealPaths,
          ]),
        ],
      });
      const selectedItem = model.getItem(selected);
      if (
        !reveal.current.complete &&
        selectedItem &&
        !selectedItem.isDirectory()
      ) {
        selectedItem.select();
        reveal.current.complete = true;
      }
    } finally {
      syncing.current = false;
    }
  }, [model, paths, selected]);

  useEffect(() => model.setGitStatus(gitStatus), [model, gitStatus]);
  useEffect(() => model.setIcons(treeIconsFor(links)), [model, links]);

  useEffect(
    () =>
      model.subscribe(() => {
        if (syncing.current) return;
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

  function acceptDefaultName(event: Event) {
    const pending = pendingCreate.current;
    if (!pending) return;
    const input = event
      .composedPath()
      .find(
        (target): target is HTMLInputElement =>
          target instanceof HTMLInputElement &&
          target.hasAttribute('data-item-rename-input'),
      );
    if (input?.value !== entryName(pending.path)) return;
    // Pierre omits onRename when the submitted name is unchanged.
    pendingCreate.current = null;
    void latest.current
      .onCreate(pending.path, pending.kind)
      .catch(() => model.resetPaths(latest.current.paths));
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDownCapture={(event) => {
        if (event.key === 'Enter') acceptDefaultName(event.nativeEvent);
        if (event.key === 'Escape') pendingCreate.current = null;
      }}
      onBlurCapture={(event) => acceptDefaultName(event.nativeEvent)}
    >
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
          const link = latest.current.links.some(
            (entry) => entry.path === path,
          );
          const actions = [
            ...(!link && folder
              ? [
                  {
                    label: 'New file',
                    icon: FilePlusIcon,
                    run: () => latest.current.onStartCreate('file', path),
                  },
                  {
                    label: 'New folder',
                    icon: FolderPlusIcon,
                    run: () => latest.current.onStartCreate('directory', path),
                  },
                  'separator-create' as const,
                ]
              : []),
            ...(!link
              ? [
                  {
                    label: 'Rename',
                    icon: PencilIcon,
                    run: () => model.startRenaming(path),
                  },
                ]
              : []),
            ...(openable
              ? [
                  {
                    label: changed ? 'Open diff' : 'Open',
                    icon: changed ? FileDiffIcon : FileCodeIcon,
                    run: () =>
                      changed
                        ? latest.current.onOpenDiff(path)
                        : latest.current.onOpenFile(path),
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
            'separator-trash' as const,
            {
              label: 'Move to trash',
              icon: Trash2Icon,
              run: () => latest.current.onTrash(path),
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
                  <Separator key={action} className="-mx-1 my-1" />
                ) : (
                  <Fragment key={action.label}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        context.close({
                          restoreFocus: action.label !== 'Rename',
                        });
                        action.run();
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-accent focus-visible:bg-accent',
                        action.label === 'Move to trash' && 'text-destructive',
                      )}
                    >
                      <action.icon
                        className={cn(
                          'size-3.5',
                          action.label !== 'Move to trash' &&
                            'text-muted-foreground',
                        )}
                      />
                      {action.label}
                    </button>
                  </Fragment>
                ),
              )}
            </div>
          );
        }}
      />
    </div>
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
