import { Cause, Effect, Option } from 'effect';
import type { Atom, AtomRegistry } from 'effect/reactivity';
import { useAtomValue } from '@effect/atom-react';
import { moveFileEntries } from '@porcelain/client/files';
import { FileTree, type ContextMenuItem } from '@pierre/trees';
import { useId, useState } from 'react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { atomRegistry } from '@/shared/store';
import { fileTreeInputs, type PierreFileTreeInput } from '../store';
import { treeIconsFor } from './file-icons';
import {
  canDropPaths,
  directoryPaths,
  entryName,
  fileTreeExpansion,
  nextCreatePath,
  selectedDirectories,
} from '@porcelain/client/files/rules';

function expandedDirectories(model: FileTree, paths: readonly string[]) {
  return directoryPaths(paths).filter((path) => {
    const item = model.getItem(path);
    return item !== null && 'isExpanded' in item && item.isExpanded();
  });
}

type MenuTarget = {
  item: ContextMenuItem;
  row: HTMLElement;
  pathsKey: string;
  filter: string;
  rename: () => void;
  finalFocus: () => HTMLElement | false;
  close: (restoreFocus: boolean) => void;
};

export function PierreFileTree(props: PierreFileTreeInput) {
  const input = fileTreeInputs(useId());
  const registry = useAtomValue(atomRegistry);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const current =
    menuTarget?.pathsKey === props.paths.join('\0') &&
    menuTarget.filter === props.filter;
  if (menuOpen && !current) setMenuOpen(false);
  function attach(host: HTMLDivElement | null) {
    if (!host) return;
    return mountTree(host, registry, input, setMenuTarget, setMenuOpen);
  }
  return (
    <ContextMenu open={menuOpen && current} onOpenChange={setMenuOpen}>
      <ContextMenuTrigger
        render={<div className="flex min-h-0 flex-1 flex-col" />}
      >
        <span
          hidden
          ref={(node) => {
            if (node) registry.set(input, Option.some(props));
          }}
        />
        <div ref={attach} className="flex min-h-0 flex-1 flex-col" />
      </ContextMenuTrigger>
      {menuOpen && current && menuTarget && (
        <span
          hidden
          ref={() => {
            const { row } = menuTarget;
            row.setAttribute('aria-haspopup', 'menu');
            row.setAttribute('data-context-menu-open', '');
            return () => {
              row.removeAttribute('aria-haspopup');
              row.removeAttribute('data-context-menu-open');
            };
          }}
        />
      )}
      {menuTarget &&
        props.renderMenu(
          menuTarget.item,
          {
            finalFocus: current ? menuTarget.finalFocus : () => false,
            close: menuTarget.close,
          },
          menuTarget.rename,
        )}
    </ContextMenu>
  );
}

function mountTree(
  host: HTMLDivElement,
  registry: AtomRegistry.AtomRegistry,
  input: Atom.Writable<Option.Option<PierreFileTreeInput>>,
  setMenuTarget: (target: MenuTarget | null) => void,
  setMenuOpen: (open: boolean) => void,
) {
  const read = () => Option.getOrThrow(registry.get(input));
  let active = true;
  let syncing = false;
  let reveal = { selected: '', complete: false };
  let pendingCreate: { path: string; kind: 'file' | 'directory' } | null = null;
  let handledCreate: number | undefined;
  const frames = new Set<number>();
  function frame(run: () => void) {
    const id = requestAnimationFrame(() => {
      frames.delete(id);
      if (active) run();
    });
    frames.add(id);
  }
  const model = new FileTree({
    paths: read().paths,
    density: 'default',
    flattenEmptyDirectories: true,
    initialExpansion: 'closed',
    icons: treeIconsFor(read().links),
    unsafeCSS:
      '[data-item-section="icon"] > svg { color: var(--trees-fg-muted); } [data-context-menu-open] { outline: 1px solid var(--trees-fg-muted); outline-offset: -1px; border-radius: 4px; }',
    gitStatus: read().gitStatus,
    search: false,
    onSearchChange: (value) => {
      if (value === null || value === undefined) read().onFilterChange('');
    },
    renaming: {
      onError: (error) => {
        pendingCreate = null;
        read().onInvalidName(error);
        queueMicrotask(() => {
          if (active) model.resetPaths(read().paths);
        });
      },
      onRename: (event) => {
        const pending = pendingCreate;
        pendingCreate = null;
        const operation =
          pending?.path.replace(/\/$/, '') ===
          event.sourcePath.replace(/\/$/, '')
            ? read().onCreate(event.destinationPath, pending.kind)
            : read().onMove(event.sourcePath, event.destinationPath);
        void operation.catch(() => {
          if (active) model.resetPaths(read().paths);
        });
      },
    },
    dragAndDrop: {
      canDrag: () => {
        syncing = true;
        queueMicrotask(() => {
          syncing = false;
        });
        return true;
      },
      canDrop: ({ draggedPaths, target }) =>
        canDropPaths(draggedPaths, target.directoryPath ?? ''),
      onDropComplete: (event) => {
        const onMove = read().onMove;
        void Effect.runPromise(
          moveFileEntries(
            event.draggedPaths,
            event.target.directoryPath ?? '',
            (from, to) =>
              Effect.tryPromise({
                try: () => onMove(from, to),
                catch: (cause) => new Cause.UnknownError(cause),
              }),
          ),
        ).catch(() => {
          if (active) model.resetPaths(read().paths);
        });
      },
    },
    renderRowDecoration: ({ item }) => {
      const link = read().links.find((entry) => entry.path === item.path);
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
        !syncing &&
        path &&
        pendingCreate?.path.replace(/\/$/, '') !== path.replace(/\/$/, '') &&
        path !== read().selected
      )
        read().onSelect(path);
    },
  });

  function bindControls() {
    read().bindCollapseAll(() => {
      syncing = true;
      reveal = { selected: read().selected, complete: true };
      model.setSearch(null);
      model.resetPaths(read().paths, { initialExpandedPaths: [] });
      syncing = false;
    });
    read().bindRename((path) => {
      frame(() => {
        syncing = true;
        model.startRenaming(path);
        syncing = false;
      });
    });
  }
  function create() {
    const { creating } = read();
    if (!creating || handledCreate === creating.nonce) return;
    handledCreate = creating.nonce;
    const path = nextCreatePath(
      creating.kind,
      creating.folder,
      (candidate) => model.getItem(candidate) !== null,
    );
    pendingCreate = { path, kind: creating.kind };
    model.add(path);
    model.startRenaming(path, { removeIfCanceled: true });
    frame(() => {
      const input = host
        .querySelector('[data-slot="file-tree"]')
        ?.shadowRoot?.querySelector('[data-item-rename-input]');
      if (input instanceof HTMLInputElement) input.focus();
    });
  }

  function reportExpanded() {
    const expanded = expandedDirectories(model, read().paths).map((path) =>
      path.replace(/\/$/, ''),
    );
    if (expanded.length) read().onExpand(expanded);
  }

  function reset() {
    if (pendingCreate) return;
    const { selected } = read();
    const shown = read().paths;
    if (reveal.selected !== selected) reveal = { selected, complete: false };
    const expanded = fileTreeExpansion(
      shown.flatMap((path) => {
        const kind = read().kinds.get(path);
        return kind === undefined ? [] : [{ path, kind }];
      }),
      new Set(expandedDirectories(model, shown)),
      new Set(
        directoryPaths(shown).filter((path) => model.getItem(path) !== null),
      ),
    ).map((path) => `${path}/`);
    syncing = true;
    {
      const revealPaths = reveal.complete ? [] : selectedDirectories(selected);
      model.resetPaths(shown, {
        initialExpandedPaths: [...new Set([...expanded, ...revealPaths])],
      });
      const selectedItem = model.getItem(selected);
      if (!reveal.complete && selectedItem && !selectedItem.isDirectory()) {
        selectedItem.select();
        reveal.complete = true;
      }
    }
    syncing = false;
    reportExpanded();
  }
  let previous: PierreFileTreeInput | undefined;
  function sync() {
    const current = read();
    bindControls();
    syncing = true;
    if (!previous || previous.filter !== current.filter)
      model.setSearch(current.filter === '' ? null : current.filter);
    syncing = false;
    if (
      !previous ||
      previous.paths.join('\0') !== current.paths.join('\0') ||
      previous.selected !== current.selected
    )
      reset();
    if (previous?.gitStatus !== current.gitStatus)
      model.setGitStatus(current.gitStatus);
    if (previous?.links !== current.links)
      model.setIcons(treeIconsFor(current.links));
    previous = current;
    create();
  }
  const unsubscribeInput = registry.subscribe(input, sync);
  const unsubscribeModel = model.subscribe(() => {
    if (!syncing) reportExpanded();
  });

  function acceptDefaultName(event: Event) {
    const pending = pendingCreate;
    if (!pending) return;
    const input = event
      .composedPath()
      .find(
        (target): target is HTMLInputElement =>
          target instanceof HTMLInputElement &&
          target.hasAttribute('data-item-rename-input'),
      );
    if (input?.value.trim() === '') {
      pendingCreate = null;
      frame(reset);
      return;
    }
    if (input?.value !== entryName(pending.path)) return;
    pendingCreate = null;
    void read()
      .onCreate(pending.path, pending.kind)
      .catch(() => {
        if (active) model.resetPaths(read().paths);
      });
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
    const { paths, filter } = read();
    setMenuTarget({
      row,
      pathsKey: paths.join('\0'),
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
        frame(() => {
          syncing = true;
          model.startRenaming(path);
          syncing = false;
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

  function keyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') acceptDefaultName(event);
    if (event.key === 'Escape' && pendingCreate) {
      pendingCreate = null;
      frame(reset);
    }
  }
  function click(event: MouseEvent) {
    if (
      event.button !== 0 ||
      (!event.altKey && (event.ctrlKey || event.metaKey || event.shiftKey))
    )
      return;
    const targets = event.composedPath();
    if (targets.some((target) => target instanceof HTMLInputElement)) return;
    const row = targets.find(
      (target): target is HTMLElement =>
        target instanceof HTMLElement && target.hasAttribute('data-item-path'),
    );
    const path = row?.dataset.itemPath;
    if (!path || read().kinds.get(path) !== 'file') return;
    const item = model.getItem(path);
    if (!item || pendingCreate?.path === path) return;
    event.preventDefault();
    event.stopPropagation();
    syncing = true;
    for (const selectedPath of model.getSelectedPaths()) {
      if (selectedPath !== path) model.getItem(selectedPath)?.deselect();
    }
    item.select();
    syncing = false;
    read().onSelect(path, event.altKey);
  }
  function contextMenu(event: Event) {
    if (!targetMenu(event)) event.stopPropagation();
  }
  host.addEventListener('keydown', keyDown, true);
  host.addEventListener('click', click, true);
  host.addEventListener('blur', acceptDefaultName, true);
  host.addEventListener('contextmenu', contextMenu, true);
  host.addEventListener('touchstart', contextMenu, true);
  model.render({ containerWrapper: host });
  model.getFileTreeContainer()?.setAttribute('class', 'min-h-0 flex-1');
  model.getFileTreeContainer()?.setAttribute('data-slot', 'file-tree');
  model.getFileTreeContainer()?.setAttribute('aria-label', 'Worktree files');
  sync();
  return () => {
    active = false;
    for (const id of frames) cancelAnimationFrame(id);
    unsubscribeInput();
    unsubscribeModel();
    read().bindRename(() => undefined);
    read().bindCollapseAll(() => undefined);
    host.removeEventListener('keydown', keyDown, true);
    host.removeEventListener('click', click, true);
    host.removeEventListener('blur', acceptDefaultName, true);
    host.removeEventListener('contextmenu', contextMenu, true);
    host.removeEventListener('touchstart', contextMenu, true);
    model.cleanUp();
    host.replaceChildren();
  };
}
