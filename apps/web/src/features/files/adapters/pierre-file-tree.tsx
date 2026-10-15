import { Cause, Effect } from 'effect';
import { moveFileEntries } from '@porcelain/client/files';
import type { GitStatusEntry } from '@pierre/trees';
import { FileTree, useFileTree } from '@pierre/trees/react';
import {
  type ReactNode,
  useEffect,
  useState,
  useLayoutEffect,
  useRef,
} from 'react';
import type { ContextMenuItem } from '@pierre/trees';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { treeIconsFor } from './file-icons';
import {
  canDropPaths,
  directoryPaths,
  entryName,
  fileTreeExpansion,
  type FileTreeEntry,
  nextCreatePath,
  selectedDirectories,
} from '@porcelain/client/files/rules';

function expandedDirectories(
  model: ReturnType<typeof useFileTree>['model'],
  paths: readonly string[],
) {
  return directoryPaths(paths).filter((path) => {
    const item = model.getItem(path);
    return item !== null && 'isExpanded' in item && item.isExpanded();
  });
}

export function PierreFileTree({
  paths,
  kinds,
  links,
  creating,
  onCreate,
  onMove,
  gitStatus,
  selected,
  onExpand,
  renderMenu,
  bindRename,
  bindCollapseAll,
  filter,
  onFilterChange,
  onInvalidName,
  onSelect,
}: {
  paths: readonly string[];
  kinds: ReadonlyMap<string, FileTreeEntry['kind']>;
  links: readonly { path: string; kind: string; target?: string | undefined }[];
  creating?:
    | { kind: 'file' | 'directory'; folder: string; nonce: number }
    | undefined;
  onCreate: (path: string, kind: 'file' | 'directory') => Promise<void>;
  onMove: (from: string, to: string) => Promise<void>;
  gitStatus: readonly GitStatusEntry[];
  selected: string;
  onExpand: (paths: readonly string[]) => void;
  bindRename: (rename: (path: string) => void) => void;
  bindCollapseAll: (collapse: () => void) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  renderMenu: (
    item: ContextMenuItem,
    context: {
      finalFocus: () => HTMLElement | false;
      close: (restoreFocus: boolean) => void;
    },
    rename: () => void,
  ) => ReactNode;
  onInvalidName: (error: string) => void;
  onSelect: (path: string, toSide?: boolean) => void;
}) {
  const pathsKey = paths.join('\0');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<{
    item: ContextMenuItem;
    row: HTMLElement;
    pathsKey: string;
    filter: string;
    rename: () => void;
    finalFocus: () => HTMLElement | false;
    close: (restoreFocus: boolean) => void;
  } | null>(null);
  const menuTargetIsCurrent =
    menuTarget?.pathsKey === pathsKey && menuTarget.filter === filter;
  if (menuOpen && !menuTargetIsCurrent) setMenuOpen(false);

  const current = {
    paths,
    kinds,
    links,
    onCreate,
    onMove,
    gitStatus,
    selected,
    onExpand,
    renderMenu,
    bindRename,
    bindCollapseAll,
    onFilterChange,
    onInvalidName,
    onSelect,
  };
  const latest = useRef(current);
  useLayoutEffect(() => {
    latest.current = current;
  });
  const reveal = useRef({ selected: '', complete: false });
  const modelRef = useRef<ReturnType<typeof useFileTree>['model'] | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
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
      '[data-icon-name="file-tree-icon-chevron"] { color: var(--trees-fg-muted); } [data-context-menu-open] { outline: 1px solid var(--trees-fg-muted); outline-offset: -1px; border-radius: 4px; }',
    gitStatus,
    search: false,
    onSearchChange: (value) => {
      if (value === null || value === undefined)
        latest.current.onFilterChange('');
    },
    renaming: {
      onError: (error) => {
        pendingCreate.current = null;
        latest.current.onInvalidName(error);
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
      canDrag: () => {
        syncing.current = true;
        queueMicrotask(() => {
          syncing.current = false;
        });
        return true;
      },
      canDrop: ({ draggedPaths, target }) =>
        canDropPaths(draggedPaths, target.directoryPath ?? ''),
      onDropComplete: (event) => {
        void Effect.runPromise(
          moveFileEntries(
            event.draggedPaths,
            event.target.directoryPath ?? '',
            (from, to) =>
              Effect.tryPromise({
                try: () => latest.current.onMove(from, to),
                catch: (cause) => new Cause.UnknownError(cause),
              }),
          ),
        ).catch(() => modelRef.current?.resetPaths(latest.current.paths));
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
    syncing.current = true;
    model.setSearch(filter === '' ? null : filter);
    syncing.current = false;
  }, [filter, model]);
  useLayoutEffect(() => {
    modelRef.current = model;
    latest.current.bindCollapseAll(() => {
      syncing.current = true;
      reveal.current = { selected: latest.current.selected, complete: true };
      model.setSearch(null);
      model.resetPaths(latest.current.paths, { initialExpandedPaths: [] });
      syncing.current = false;
    });
    latest.current.bindRename((path) => {
      requestAnimationFrame(() => {
        syncing.current = true;
        model.startRenaming(path);
        syncing.current = false;
      });
    });
  }, [model]);
  const handledCreate = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!creating || handledCreate.current === creating.nonce) return;
    handledCreate.current = creating.nonce;
    const path = nextCreatePath(
      creating.kind,
      creating.folder,
      (candidate) => (model.getItem(candidate) ?? null) !== null,
    );
    pendingCreate.current = { path, kind: creating.kind };
    model.add(path);
    model.startRenaming(path, { removeIfCanceled: true });
    requestAnimationFrame(() => {
      const input = hostRef.current
        ?.querySelector('[data-slot="file-tree"]')
        ?.shadowRoot?.querySelector('[data-item-rename-input]');
      if (input instanceof HTMLInputElement) input.focus();
    });
  }, [creating, model]);

  function reportExpanded() {
    const expanded = expandedDirectories(model, latest.current.paths).map(
      (path) => path.replace(/\/$/, ''),
    );
    if (expanded.length) latest.current.onExpand(expanded);
  }

  useEffect(() => {
    const shown = latest.current.paths;
    if (reveal.current.selected !== selected)
      reveal.current = { selected, complete: false };
    const expanded = fileTreeExpansion(
      shown.flatMap((path) => {
        const kind = latest.current.kinds.get(path);
        return kind === undefined ? [] : [{ path, kind }];
      }),
      new Set(expandedDirectories(model, shown)),
      new Set(
        directoryPaths(shown).filter((path) => model.getItem(path) !== null),
      ),
    ).map((path) => `${path}/`);
    syncing.current = true;
    {
      const revealPaths = reveal.current.complete
        ? []
        : selectedDirectories(selected);
      model.resetPaths(
        pendingCreate.current ? [...shown, pendingCreate.current.path] : shown,
        {
          initialExpandedPaths: [...new Set([...expanded, ...revealPaths])],
        },
      );
      const selectedItem = model.getItem(selected);
      if (
        !reveal.current.complete &&
        selectedItem &&
        !selectedItem.isDirectory()
      ) {
        selectedItem.select();
        reveal.current.complete = true;
      }
    }
    syncing.current = false;
    reportExpanded();
  }, [model, pathsKey, selected]);

  useEffect(() => model.setGitStatus(gitStatus), [model, gitStatus]);
  useEffect(() => model.setIcons(treeIconsFor(links)), [model, links]);

  useEffect(
    () =>
      model.subscribe(() => {
        if (!syncing.current) reportExpanded();
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
    pendingCreate.current = null;
    void latest.current
      .onCreate(pending.path, pending.kind)
      .catch(() => model.resetPaths(latest.current.paths));
  }

  function targetMenu(event: Event) {
    const row = event
      .composedPath()
      .find(
        (target): target is HTMLElement =>
          target instanceof HTMLElement &&
          target.hasAttribute('data-item-path'),
      );
    const path = row?.dataset.itemPath;
    const item = path === undefined ? null : model.getItem(path);
    if (!row || !path || !item || row.querySelector('[data-item-rename-input]'))
      return false;
    const focus = { restore: true };
    setMenuTarget({
      row,
      pathsKey,
      filter,
      finalFocus: () =>
        focus.restore && row.isConnected && row.dataset.itemPath === path
          ? row
          : false,
      close: (restoreFocus) => {
        focus.restore = restoreFocus;
        setMenuOpen(false);
      },
      rename: () => {
        requestAnimationFrame(() => {
          syncing.current = true;
          model.startRenaming(path);
          syncing.current = false;
        });
      },
      item: {
        path,
        name: entryName(path),
        kind: item.isDirectory() ? 'directory' : 'file',
      },
    });
    return true;
  }

  useLayoutEffect(() => {
    if (!menuOpen || !menuTargetIsCurrent || !menuTarget) return;
    const { row } = menuTarget;
    row.setAttribute('aria-haspopup', 'menu');
    row.setAttribute('data-context-menu-open', '');
    return () => {
      row.removeAttribute('aria-haspopup');
      row.removeAttribute('data-context-menu-open');
    };
  }, [menuOpen, menuTarget, menuTargetIsCurrent]);

  return (
    <ContextMenu
      open={menuOpen && menuTargetIsCurrent}
      onOpenChange={setMenuOpen}
    >
      <ContextMenuTrigger
        onContextMenuCapture={(event) => {
          if (!targetMenu(event.nativeEvent)) event.stopPropagation();
        }}
        onTouchStartCapture={(event) => {
          if (!targetMenu(event.nativeEvent)) event.stopPropagation();
        }}
        render={
          <div
            ref={hostRef}
            className="flex min-h-0 flex-1 flex-col"
            onKeyDownCapture={(event) => {
              if (event.key === 'Enter') acceptDefaultName(event.nativeEvent);
              if (event.key === 'Escape') pendingCreate.current = null;
            }}
            onClickCapture={(event) => {
              if (event.button !== 0) return;
              if (
                !event.altKey &&
                (event.ctrlKey || event.metaKey || event.shiftKey)
              )
                return;
              const targets = event.nativeEvent.composedPath();
              if (targets.some((target) => target instanceof HTMLInputElement))
                return;
              const row = targets.find(
                (target): target is HTMLElement =>
                  target instanceof HTMLElement &&
                  target.hasAttribute('data-item-path'),
              );
              const path = row?.dataset.itemPath;
              if (!path || latest.current.kinds.get(path) !== 'file') return;
              const item = model.getItem(path);
              if (item === null || pendingCreate.current?.path === path) return;
              event.preventDefault();
              event.stopPropagation();
              syncing.current = true;
              for (const selectedPath of model.getSelectedPaths()) {
                if (selectedPath !== path)
                  model.getItem(selectedPath)?.deselect();
              }
              item.select();
              syncing.current = false;
              latest.current.onSelect(path, event.altKey);
            }}
            onBlurCapture={(event) => acceptDefaultName(event.nativeEvent)}
          />
        }
      >
        <FileTree
          model={model}
          data-slot="file-tree"
          aria-label="Worktree files"
          className="min-h-0 flex-1"
        />
      </ContextMenuTrigger>
      {menuTarget &&
        renderMenu(
          menuTarget.item,
          {
            finalFocus: menuTargetIsCurrent
              ? menuTarget.finalFocus
              : () => false,
            close: menuTarget.close,
          },
          menuTarget.rename,
        )}
    </ContextMenu>
  );
}
