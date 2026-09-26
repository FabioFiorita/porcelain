import type { GitStatusEntry } from '@pierre/trees';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import type { ContextMenuItem, ContextMenuOpenContext } from '@pierre/trees';
import { treeIconsFor } from './file-icons';
import {
  canDropPaths,
  directoryPaths,
  entryName,
  nextCreatePath,
  selectedDirectories,
  topLevelDraggedPaths,
} from '../rules/tree-actions';

export function PierreFileTree({
  paths,
  links,
  creating,
  onCreate,
  onMove,
  gitStatus,
  selected,
  onExpand,
  renderMenu,
  onInvalidName,
  onSelect,
}: {
  paths: readonly string[];
  links: readonly { path: string; kind: string; target?: string | undefined }[];
  creating?:
    | { kind: 'file' | 'directory'; folder: string; nonce: number }
    | undefined;
  onCreate: (path: string, kind: 'file' | 'directory') => Promise<void>;
  onMove: (from: string, to: string) => Promise<void>;
  gitStatus: readonly GitStatusEntry[];
  selected: string;
  onExpand: (paths: readonly string[]) => void;
  renderMenu: (
    item: ContextMenuItem,
    context: ContextMenuOpenContext,
    rename: () => void,
  ) => ReactNode;
  onInvalidName: (error: string) => void;
  onSelect: (path: string) => void;
}) {
  const current = {
    paths,
    links,
    onCreate,
    onMove,
    gitStatus,
    selected,
    onExpand,
    renderMenu,
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
      '[data-icon-name="file-tree-icon-chevron"] { color: var(--trees-fg-muted); }',
    gitStatus,
    search: true,
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
        const paths = topLevelDraggedPaths(event.draggedPaths);
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
    const path = nextCreatePath(
      creating.kind,
      creating.folder,
      (candidate) => model.getItem(candidate) != null,
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

  useEffect(() => {
    if (reveal.current.selected !== selected)
      reveal.current = { selected, complete: false };
    const expanded = directoryPaths(latest.current.paths).filter((path) => {
      const item = model.getItem(path);
      if (!item || !('isExpanded' in item)) return false;
      return item.isExpanded();
    });
    syncing.current = true;
    {
      const revealPaths = reveal.current.complete
        ? []
        : selectedDirectories(selected);
      model.resetPaths(
        pendingCreate.current ? [...paths, pendingCreate.current.path] : paths,
        {
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
            if (!item || !('isExpanded' in item)) return false;
            return item.isExpanded();
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
    pendingCreate.current = null;
    void latest.current
      .onCreate(pending.path, pending.kind)
      .catch(() => model.resetPaths(latest.current.paths));
  }

  return (
    <div
      ref={hostRef}
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
        renderContextMenu={(item, context) =>
          renderMenu(item, context, () => {
            requestAnimationFrame(() => {
              syncing.current = true;
              model.startRenaming(item.path);
              syncing.current = false;
            });
          })
        }
      />
    </div>
  );
}
