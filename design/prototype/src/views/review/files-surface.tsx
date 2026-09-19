import type {
  FileTreeBatchOperation,
  FileTreeMutationEvent,
  GitStatusEntry,
} from '@pierre/trees';
import {
  FileTree,
  useFileTree as usePierreFileTree,
} from '@pierre/trees/react';
import {
  Copy,
  Eye,
  EyeOff,
  FileCode,
  FileDiff,
  FilePlus,
  FolderPlus,
  type LucideIcon,
  Pencil,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { DirectoryEntry, DirectoryListing } from '../../contracts/files';
import { type DocumentRef, parseEntry } from '../../domain/documents';
import { entryName, hiddenBy, visiblePaths } from '../../domain/files';
import { changeKind, changePath, type ReviewScope } from '../../domain/review';
import { useHiddenPaths, useSetHidden } from '../../query/file-preferences';
import {
  useCreateEntry,
  useDirectories,
  useDirectory,
  useLoadDirectory,
  useMoveEntry,
  useRemoveEntry,
} from '../../query/files';
import { reviewErrorMessage, useChanges } from '../../query/review';
import { copyText } from '../workspace/copy';
import {
  notifyFailure,
  notifySuccess,
  reportFailure,
} from '../workspace/notify';
import { openQuickOpen, quickOpenKeys } from '../workspace/quick-open-store';
import { type TreeLink, treeIconsFor } from './file-icons';
import { ReviewPending } from './review-boundary';
import type { OpenDocument } from './review-workspace';

type Props = {
  scope: ReviewScope;
  worktreePath: string;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
};

type TreeModel = ReturnType<typeof usePierreFileTree>['model'];

/**
 * Loaded folders by tree path: `''` is the root, a folder ends with `/` (`src/`).
 * The tree shows exactly what these listings say, so a reload of any folder, an
 * edit made here, or a live notice all reach the tree the same way.
 */
type Listings = ReadonlyMap<string, readonly DirectoryEntry[]>;

const TREE_STATUS = {
  added: 'added',
  modified: 'modified',
  deleted: 'deleted',
  renamed: 'renamed',
  conflicted: 'modified',
} as const;

type MenuAction =
  | { label: string; icon: LucideIcon; run: () => void; destructive?: boolean }
  | 'separator';

const MENU_MARGIN = 8;

/**
 * Pierre only hands over the row's rect, so the menu places itself: below and
 * left-aligned by default, flipped above or right-aligned when that would leave
 * the window, then clamped inside it.
 */
function placeMenu(
  menu: HTMLElement | null,
  anchor: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>,
) {
  if (menu == null) return;
  const { width, height } = menu.getBoundingClientRect();
  const fitsBelow =
    anchor.bottom + 4 + height <= window.innerHeight - MENU_MARGIN;
  const fitsRight = anchor.left + width <= window.innerWidth - MENU_MARGIN;
  const top = fitsBelow ? anchor.bottom + 4 : anchor.top - 4 - height;
  const left = fitsRight ? anchor.left : anchor.right - width;
  menu.style.top = `${Math.max(MENU_MARGIN, Math.min(top, window.innerHeight - MENU_MARGIN - height))}px`;
  menu.style.left = `${Math.max(MENU_MARGIN, Math.min(left, window.innerWidth - MENU_MARGIN - width))}px`;
}

const withSlash = (path: string) => (path.endsWith('/') ? path : `${path}/`);
/** The server names folders without the trailing slash; the root is `''`. */
const serverPath = (folder: string) => folder.replace(/\/+$/, '');
const leafName = (path: string) => entryName(path).replace(/\/$/, '');
/** `src/a/b.ts` → `src/a/`, `src/a/` → `src/`, `a.ts` → `''`. */
function parentFolder(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  const index = trimmed.lastIndexOf('/');
  return index === -1 ? '' : trimmed.slice(0, index + 1);
}
const isWithin = (path: string, target: string) =>
  path === target || (target.endsWith('/') && path.startsWith(target));
const childPath = (folder: string, entry: DirectoryEntry) =>
  `${folder}${entry.name}${entry.kind === 'directory' ? '/' : ''}`;

type TreeState = {
  paths: string[];
  ignored: string[];
  links: TreeLink[];
  /** Every folder the tree shows, loaded or not. */
  folders: string[];
  /** Loaded folders reachable from the root; a listing outside this set is stale. */
  reachable: Set<string>;
};

/**
 * Walks from the root through loaded folders only, so the listing of a folder
 * that was moved or deleted never outlives its entry in the parent.
 */
function treeFrom(listings: Listings): TreeState {
  const state: TreeState = {
    paths: [],
    ignored: [],
    links: [],
    folders: [],
    reachable: new Set(),
  };
  const walk = (folder: string) => {
    state.reachable.add(folder);
    for (const entry of listings.get(folder) ?? []) {
      const path = childPath(folder, entry);
      state.paths.push(path);
      if (entry.ignored) state.ignored.push(path);
      if (entry.kind === 'symlink' || entry.kind === 'submodule')
        state.links.push({ path, kind: entry.kind, target: entry.target });
      if (entry.kind === 'directory') {
        state.folders.push(path);
        if (listings.has(path)) walk(path);
      }
    }
  };
  walk('');
  return state;
}

/** Adds (or replaces) one entry in its parent's listing, if the parent is loaded. */
function withEntry(
  listings: Listings,
  path: string,
  entry: DirectoryEntry,
): Listings {
  const parent = parentFolder(path);
  const siblings = listings.get(parent);
  if (siblings == null) return listings;
  return new Map(listings).set(parent, [
    ...siblings.filter((sibling) => sibling.name !== entry.name),
    entry,
  ]);
}

/** Drops one entry from its parent's listing, and the listings of everything inside it. */
function withoutEntry(listings: Listings, path: string): Listings {
  const next = new Map(listings);
  for (const key of listings.keys())
    if (key !== '' && isWithin(key, path)) next.delete(key);
  const parent = parentFolder(path);
  const siblings = next.get(parent);
  if (siblings != null)
    next.set(
      parent,
      siblings.filter((entry) => entry.name !== leafName(path)),
    );
  return next;
}

/** A rename or move: the entry changes parent or name, and loaded folders inside it move along. */
function withMove(listings: Listings, from: string, to: string): Listings {
  const entry = listings
    .get(parentFolder(from))
    ?.find((candidate) => candidate.name === leafName(from));
  let next: Listings = new Map(
    [...listings].map(
      ([key, entries]) =>
        [
          key !== '' && isWithin(key, from) ? to + key.slice(from.length) : key,
          entries,
        ] as const,
    ),
  );
  const siblings = next.get(parentFolder(from));
  if (siblings != null)
    next = new Map(next).set(
      parentFolder(from),
      siblings.filter((candidate) => candidate.name !== leafName(from)),
    );
  return entry == null
    ? next
    : withEntry(next, to, { ...entry, name: leafName(to) });
}

/** Keeps the set of paths the tree holds in step with every mutation, whoever made it. */
function applyMutation(paths: Set<string>, event: FileTreeMutationEvent) {
  switch (event.operation) {
    case 'add':
      paths.add(event.path);
      return;
    case 'remove':
      for (const path of [...paths])
        if (path === event.path || path.startsWith(withSlash(event.path)))
          paths.delete(path);
      return;
    case 'move':
      for (const path of [...paths]) {
        if (path === event.from || path.startsWith(withSlash(event.from))) {
          paths.delete(path);
          paths.add(event.to + path.slice(event.from.length));
        }
      }
      return;
    case 'batch':
      for (const child of event.events) applyMutation(paths, child);
      return;
    case 'reset':
      // Only this surface resets, and it records the new paths itself.
      return;
  }
}

function isExpanded(model: TreeModel, folder: string): boolean {
  const item = model.getItem(folder);
  return item != null && 'isExpanded' in item && item.isExpanded();
}

/** `a/b/c.ts` → `['a/', 'a/b/']`. */
function foldersAbove(path: string): string[] {
  const parts = path.split('/').slice(0, -1);
  return parts.map((_, index) => `${parts.slice(0, index + 1).join('/')}/`);
}

/** The tree's selection is the open file, or nothing. */
function selectOnly(model: TreeModel, path: string | null) {
  for (const selected of model.getSelectedPaths())
    if (selected !== path) model.getItem(selected)?.deselect();
  if (path != null) model.getItem(path)?.select();
}

/** The file an entry shows, whether as the file or as its diff. */
function entryPath(entry: string | undefined): string | null {
  const ref = parseEntry(entry);
  return ref?.kind === 'file' || ref?.kind === 'change' ? ref.path : null;
}

const isNotFound = (error: unknown) =>
  typeof error === 'object' &&
  error != null &&
  (error as { code?: unknown }).code === 'DIRECTORY_NOT_FOUND';

/**
 * The Files surface. The root comes first; every other folder loads when it is
 * opened, including ignored ones like `dist/`. Symlinks and submodules are
 * leaves and are never followed.
 */
export function FilesSurface(props: Props) {
  const root = useDirectory(props.scope, '');
  if (root.data == null) {
    if (root.error == null) return <ReviewPending rows={10} />;
    return (
      <div className="grid h-full min-h-40 place-items-center p-6 text-center">
        <div className="flex max-w-xs flex-col items-center gap-2">
          <TriangleAlert className="size-5 text-muted-foreground" />
          <p className="text-sm">{reviewErrorMessage(root.error)}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void root.refetch()}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }
  return <FilesTree {...props} root={root.data} />;
}

/** Replaces every path at once, keeping each folder open that was open. */
function resetKeepingExpansion(
  model: TreeModel,
  applied: Set<string>,
  paths: readonly string[],
): Set<string> {
  const expanded = [...applied].filter(
    (path) => path.endsWith('/') && isExpanded(model, path),
  );
  model.resetPaths(paths, { initialExpandedPaths: expanded });
  return new Set(paths);
}

/** Symlinks and submodules as one string, so icon rules are rebuilt only when they change. */
const linksKeyOf = (links: readonly TreeLink[]) =>
  JSON.stringify(links.map((link) => [link.kind, link.path]));
const linksFromKey = (key: string): TreeLink[] =>
  (JSON.parse(key) as [TreeLink['kind'], string][]).map(([kind, path]) => ({
    kind,
    path,
  }));

/**
 * @pierre/trees owns rows, virtualization, keyboard navigation, git status,
 * inline rename and drag and drop. This surface decides what those gestures mean
 * on disk (create, rename, move, delete to the trash, hide) and feeds the tree
 * folder by folder.
 */
function FilesTree({
  scope,
  worktreePath,
  activeEntry,
  onOpen,
  root,
}: Props & { root: DirectoryListing }) {
  const { changes } = useChanges(scope);
  const hidden = useHiddenPaths(scope.projectId);
  const setHidden = useSetHidden(scope.projectId);
  const createEntry = useCreateEntry(scope);
  const moveEntry = useMoveEntry(scope);
  const removeEntry = useRemoveEntry(scope);
  const loadDirectory = useLoadDirectory(scope);
  const [showHidden, setShowHidden] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  /**
   * What the tree shows: the server's listings, with this surface's own edits
   * applied at once so the tree never jumps back while the server works.
   */
  const [listings, setListings] = useState<Listings>(
    () => new Map([['', root.entries]]),
  );
  /**
   * Folders whose listing moved with a rename or drag that the server has not
   * confirmed yet. They are not read meanwhile: reading them now would find
   * nothing on disk and drop them.
   */
  const [settling, setSettling] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const tree = useMemo(() => treeFrom(listings), [listings]);

  // Every opened folder (the root included) stays observed, so a live notice that
  // names it reloads it. A folder gone from its parent is no longer read.
  const watched = useMemo(
    () =>
      [...listings.keys()].filter(
        (folder) => tree.reachable.has(folder) && !settling.has(folder),
      ),
    [listings, tree.reachable, settling],
  );
  const reads = useDirectories(scope, watched.map(serverPath));
  // Fold each new read into the listings, once per read (React's "adjust state
  // while rendering" pattern): only a folder whose read changed is replaced, so a
  // reload of one folder never undoes an edit waiting in another.
  const [folded, setFolded] = useState<ReadonlyMap<string, unknown>>(
    () => new Map(),
  );
  // A failed reload keeps the old data beside the error; the error is the news then.
  const latestReads = new Map(
    watched.map((folder, index) => [
      folder,
      reads[index]?.isError ? reads[index].error : reads[index]?.data,
    ]),
  );
  const reloaded = watched.filter(
    (folder) =>
      latestReads.get(folder) != null &&
      latestReads.get(folder) !== folded.get(folder),
  );
  if (reloaded.length > 0) {
    setFolded(latestReads);
    setListings((current) => {
      let next: Listings = current;
      for (const folder of reloaded) {
        const read = reads[watched.indexOf(folder)];
        if (read == null || !next.has(folder)) continue;
        if (read.isError) {
          // Deleted or moved elsewhere. Any other failure keeps the last listing.
          if (isNotFound(read.error)) next = withoutEntry(next, folder);
        } else if (
          read.data != null &&
          next.get(folder) !== read.data.entries
        ) {
          next = new Map(next).set(folder, read.data.entries);
        }
      }
      return next;
    });
  }

  const changed = useMemo(() => new Set(changes.map(changePath)), [changes]);
  const gitStatus = useMemo<GitStatusEntry[]>(
    () => [
      // Pierre's own `ignored` status dims the row and everything under an ignored folder.
      ...tree.ignored.map((path) => ({ path, status: 'ignored' as const })),
      ...changes.map((change) => ({
        path: changePath(change),
        status: TREE_STATUS[changeKind(change)],
      })),
    ],
    [changes, tree.ignored],
  );
  const links = useMemo(
    () => new Map(tree.links.map((link) => [link.path, link])),
    [tree.links],
  );
  // `tree.links` is a new array on every listing; the icon rules only change with the names.
  const linksKey = linksKeyOf(tree.links);
  const icons = useMemo(() => treeIconsFor(linksFromKey(linksKey)), [linksKey]);
  // `hidden` is a new Set every render; its sorted contents are the real dependency.
  const hiddenKey = [...hidden].sort().join('\n');
  const hiddenPaths = useMemo(
    () => new Set(hiddenKey === '' ? [] : hiddenKey.split('\n')),
    [hiddenKey],
  );
  const visible = useMemo(
    () => (showHidden ? tree.paths : visiblePaths(tree.paths, hiddenPaths)),
    [tree.paths, showHidden, hiddenPaths],
  );

  /** The paths the tree holds right now, kept in step by its mutation events. */
  const applied = useRef<Set<string>>(new Set(visible));
  /** A placeholder row waiting for its name, from New file / New folder. */
  const pendingCreate = useRef<{
    path: string;
    kind: 'file' | 'directory';
  } | null>(null);
  /** Folders being read right now. */
  const loading = useRef(new Map<string, Promise<void>>());
  /** Folders just opened by the reviewer; one holding a single folder opens that too. */
  const openedByHand = useRef(new Set<string>());
  /** The open file, highlighted in the tree; `revealed` is the last one brought into view. */
  const openPath = entryPath(activeEntry);
  const revealed = useRef<string | null>(null);

  const refFor = (path: string): DocumentRef =>
    changed.has(path) ? { kind: 'change', path } : { kind: 'file', path };

  /**
   * A rename or move, applied to the listings at once so the tree never jumps back
   * while the server works. `done` starts reading the moved folders again; `undo`
   * puts the entry back where it was when the server refuses.
   */
  const settle = (from: string, to: string) => {
    const entry = listings
      .get(parentFolder(from))
      ?.find((candidate) => candidate.name === leafName(from));
    const moved = [...listings.keys()]
      .filter((key) => key !== '' && isWithin(key, from))
      .map((key) => to + key.slice(from.length));
    const release = () =>
      setSettling(
        (current) =>
          new Set([...current].filter((key) => !moved.includes(key))),
      );
    setListings((current) => withMove(current, from, to));
    if (moved.length > 0)
      setSettling((current) => new Set([...current, ...moved]));
    return {
      done: release,
      undo: () => {
        setListings((current) => {
          const back = withMove(current, to, from);
          // Moved into a folder that was never opened: the entry has to be put back by hand.
          const restored =
            back
              .get(parentFolder(from))
              ?.some((candidate) => candidate.name === leafName(from)) ?? true;
          return restored || entry == null
            ? back
            : withEntry(back, from, entry);
        });
        release();
      },
    };
  };

  const handleRename = (
    sourcePath: string,
    destinationPath: string,
    isFolder: boolean,
  ) => {
    const to = isFolder ? withSlash(destinationPath) : destinationPath;
    const pending = pendingCreate.current;
    if (
      pending != null &&
      pending.path.replace(/\/+$/, '') === sourcePath.replace(/\/+$/, '')
    ) {
      pendingCreate.current = null;
      setListings((current) =>
        withEntry(current, to, {
          name: leafName(to),
          kind: pending.kind,
          ignored: false,
        }),
      );
      createEntry.submit({ path: to, kind: pending.kind }).then(
        () => {
          notifySuccess(`Created ${entryName(to)}`);
          if (pending.kind === 'file') onOpen({ kind: 'file', path: to });
        },
        (error: unknown) => {
          setListings((current) => withoutEntry(current, to));
          notifyFailure(`${entryName(to)} was not created`, error);
        },
      );
      return;
    }
    const from = isFolder ? withSlash(sourcePath) : sourcePath;
    const edit = settle(from, to);
    moveEntry.submit({ from, to }).then(
      () => {
        edit.done();
        notifySuccess(`Renamed to ${entryName(to)}`);
      },
      (error: unknown) => {
        edit.undo();
        notifyFailure(`${entryName(from)} was not renamed`, error);
      },
    );
  };

  const handleDrop = (draggedPaths: readonly string[], folder: string) => {
    const moves = draggedPaths
      .map((from) => ({ from, to: `${folder}${entryName(from)}` }))
      .filter((move) => move.from !== move.to);
    if (moves.length === 0) return;
    const edits = moves.map((move) => settle(move.from, move.to));
    // One at a time, in order; the first refusal puts back that move and the ones after it.
    void (async () => {
      for (const [index, move] of moves.entries()) {
        try {
          await moveEntry.submit(move);
          edits[index]?.done();
        } catch (error) {
          for (const edit of edits.slice(index)) edit.undo();
          notifyFailure('The move did not finish', error);
          return;
        }
      }
      notifySuccess(
        moves.length === 1
          ? `Moved ${entryName(moves[0]?.from ?? '')}`
          : `Moved ${moves.length} items`,
      );
    })();
  };

  // The model is created once; its callbacks read the latest render through this ref,
  // which is filled in after each render (see the layout effect below).
  const latest = useRef<{
    model: TreeModel | null;
    refFor: typeof refFor;
    handleRename: typeof handleRename;
    handleDrop: typeof handleDrop;
    onOpen: OpenDocument;
    openPath: string | null;
    hidden: ReadonlySet<string>;
    showHidden: boolean;
    links: ReadonlyMap<string, TreeLink>;
    tree: TreeState;
    listings: Listings;
    settling: ReadonlySet<string>;
    loadFolder: (folder: string) => Promise<void>;
  } | null>(null);

  const { model } = usePierreFileTree({
    paths: visible,
    icons,
    initialExpansion: 'closed',
    gitStatus,
    density: 'compact',
    flattenEmptyDirectories: true,
    renaming: {
      onRename: (event) =>
        latest.current?.handleRename(
          event.sourcePath,
          event.destinationPath,
          event.isFolder,
        ),
      onError: (error) =>
        toast.add({
          title: 'Cannot use that name',
          description: error,
          type: 'error',
        }),
    },
    dragAndDrop: {
      canDrop: ({ draggedPaths, target }) =>
        !draggedPaths.some(
          (path) =>
            path.endsWith('/') && (target.directoryPath ?? '').startsWith(path),
        ),
      onDropComplete: (event) =>
        latest.current?.handleDrop(
          event.draggedPaths,
          event.target.directoryPath ?? '',
        ),
    },
    renderRowDecoration: ({ item }) => {
      const current = latest.current;
      if (current == null) return null;
      if (current.showHidden && hiddenBy(item.path, current.hidden) != null) {
        return { text: 'hidden', title: 'Hidden in Files for this project' };
      }
      const link = current.links.get(item.path);
      if (link == null) return null;
      return link.kind === 'symlink'
        ? {
            text: `→ ${link.target ?? '?'}`,
            title: `Symlink to ${link.target ?? 'an unknown target'}; not followed`,
          }
        : { text: 'submodule', title: 'Git submodule; not followed' };
    },
    onSelectionChange: (paths) => {
      const [path] = paths;
      if (path == null || path.endsWith('/')) return;
      // Adding a placeholder for New file selects it; it is not a file yet.
      const pending = pendingCreate.current;
      if (pending != null && pending.path === path) return;
      // The selection follows the open file (see the reveal below), so selecting that
      // one opens nothing. Once another tab is active it is deselected, so clicking the
      // file again reopens it.
      if (path === latest.current?.openPath) return;
      latest.current?.onOpen(latest.current.refFor(path));
    },
  });

  /** Reads a folder once (the tree asks when it opens), then a watcher keeps it live. */
  const loadFolder = (folder: string): Promise<void> => {
    const running = loading.current.get(folder);
    if (running != null) return running;
    const request = loadDirectory(serverPath(folder)).then(
      (listing) => {
        loading.current.delete(folder);
        openedByHand.current.add(folder);
        setListings((current) => new Map(current).set(folder, listing.entries));
      },
      (error: unknown) => {
        loading.current.delete(folder);
        const item = model.getItem(folder);
        if (item != null && 'collapse' in item) item.collapse();
        notifyFailure(`Couldn’t open ${entryName(folder)}`, error);
      },
    );
    loading.current.set(folder, request);
    return request;
  };

  useLayoutEffect(() => {
    latest.current = {
      model,
      refFor,
      handleRename,
      handleDrop,
      onOpen,
      openPath,
      hidden,
      showHidden,
      links,
      tree,
      listings,
      settling,
      loadFolder,
    };
  });

  // Whatever changes the tree (a reconcile below, Pierre's own rename or drag, a
  // cancelled placeholder), `applied` follows.
  useEffect(
    () =>
      model.onMutation('*', (event) => applyMutation(applied.current, event)),
    [model],
  );

  // Opening a folder loads it. The tree has no "expanded" callback, so every model
  // update checks the folders it shows but has not loaded.
  useEffect(
    () =>
      model.subscribe(() => {
        const current = latest.current;
        if (current == null) return;
        for (const folder of current.tree.folders) {
          if (
            current.listings.has(folder) ||
            current.settling.has(folder) ||
            loading.current.has(folder)
          )
            continue;
          if (isExpanded(model, folder)) void current.loadFolder(folder);
        }
      }),
    [model],
  );

  // Reconcile: bring the tree to exactly `visible` with adds and removes, so
  // folders the reviewer opened stay open whatever reloaded.
  useEffect(() => {
    const target = new Set(visible);
    const placeholder = pendingCreate.current?.path;
    const removed = [...applied.current].filter(
      (path) => !target.has(path) && path !== placeholder,
    );
    const removedFolders = removed.filter((path) => path.endsWith('/'));
    const operations: FileTreeBatchOperation[] = [
      ...removed
        .filter(
          (path) =>
            !removedFolders.some(
              (folder) => folder !== path && path.startsWith(folder),
            ),
        )
        .filter((path) => model.getItem(path) != null)
        .map((path) => ({
          type: 'remove' as const,
          path,
          recursive: path.endsWith('/'),
        })),
      ...visible
        .filter(
          (path) => !applied.current.has(path) && model.getItem(path) == null,
        )
        .map((path) => ({ type: 'add' as const, path })),
    ];
    if (operations.length > 0) {
      try {
        model.batch(operations);
      } catch {
        // The tree disagreed about what it holds; start from the listings again.
        applied.current = resetKeepingExpansion(
          model,
          applied.current,
          visible,
        );
      }
    }
    // A folder opened by hand that holds only one folder opens that one too, so a
    // chain like `.agents/skills/` reads as one row, as the tree flattens it.
    for (const folder of openedByHand.current) {
      const entries = listings.get(folder) ?? [];
      const only = entries.length === 1 ? entries[0] : undefined;
      if (only?.kind === 'directory' && !only.ignored) {
        const item = model.getItem(childPath(folder, only));
        if (item != null && 'expand' in item) item.expand();
      }
    }
    openedByHand.current.clear();
  }, [model, visible, listings]);

  // Reveal the open file (from a tab, quick open, a comment or this tree): read the
  // folders above it one by one, open them, select it and scroll to it. It runs after
  // the reconcile above, so the rows a read added are in the tree. Once revealed, it
  // is left alone: closing its folder afterwards is the reviewer's choice.
  useEffect(() => {
    if (openPath == null) {
      if (revealed.current != null) selectOnly(model, null);
      revealed.current = null;
      return;
    }
    if (revealed.current === openPath) return;
    const folders = foldersAbove(openPath);
    const unread = folders.find((folder) => !listings.has(folder));
    if (unread != null) {
      const parent = listings.get(parentFolder(unread));
      // The parent's read is on its way, from the previous run.
      if (parent == null) return;
      if (
        parent.some(
          (entry) =>
            entry.kind === 'directory' && entry.name === leafName(unread),
        )
      ) {
        void latest.current?.loadFolder(unread);
        return;
      }
      // Not on disk (deleted, or inside a link that is not followed): nothing to show.
    } else if (model.getItem(openPath) == null && visible.includes(openPath)) {
      return;
    }
    revealed.current = openPath;
    if (model.getItem(openPath) == null) {
      // Gone, or hidden in Files.
      selectOnly(model, null);
      return;
    }
    const closed = folders.filter((folder) => !isExpanded(model, folder));
    for (const folder of closed) {
      const item = model.getItem(folder);
      if (item != null && 'expand' in item) item.expand();
    }
    selectOnly(model, openPath);
    // A click in the tree leaves the row where it is; a file found deeper is centred.
    model.scrollToPath(openPath, {
      focus: false,
      offset: closed.length > 0 ? 'center' : 'nearest',
    });
  }, [model, visible, listings, openPath]);

  useEffect(() => {
    model.setGitStatus(gitStatus);
  }, [model, gitStatus]);

  useEffect(() => {
    model.setIcons(icons);
  }, [model, icons]);

  // With hidden rows on screen, re-render them so the "hidden" label follows the set.
  const shownHiddenKey = useRef(hiddenKey);
  useEffect(() => {
    if (shownHiddenKey.current === hiddenKey) return;
    shownHiddenKey.current = hiddenKey;
    if (showHidden)
      applied.current = resetKeepingExpansion(model, applied.current, visible);
  }, [model, hiddenKey, showHidden, visible]);

  /** New file / New folder: a placeholder row named with the tree's own rename. Escape removes it. */
  const startCreate = async (kind: 'file' | 'directory', folder: string) => {
    // Inside a folder never opened, read it first so the new name is checked against what is there.
    if (folder !== '' && !listings.has(folder)) await loadFolder(folder);
    const taken = new Set(applied.current);
    const base = kind === 'file' ? 'untitled' : 'new-folder';
    const suffix = kind === 'directory' ? '/' : '';
    let name = base;
    for (let index = 2; taken.has(`${folder}${name}${suffix}`); index += 1)
      name = `${base}-${index}`;
    const path = `${folder}${name}${suffix}`;
    pendingCreate.current = { path, kind };
    model.add(path);
    if (!model.startRenaming(path, { removeIfCanceled: true })) {
      model.remove(path, { recursive: kind === 'directory' });
      pendingCreate.current = null;
    }
  };

  const show = (path: string) => {
    reportFailure(
      setHidden.submit({ path, hidden: false }),
      `${entryName(path)} was not shown again`,
    );
  };

  const hide = (path: string) => {
    reportFailure(
      setHidden.submit({ path, hidden: true }).then(() =>
        toast.add({
          title: `Hid ${entryName(path)}`,
          description:
            'Only in Files, for every worktree of this project. Changes still show in Review.',
          actionProps: { children: 'Undo', onClick: () => show(path) },
        }),
      ),
      `${entryName(path)} was not hidden`,
    );
  };

  const confirmDelete = (path: string) => {
    removeEntry.submit({ path }).then(
      () => {
        setListings((current) => withoutEntry(current, path));
        setDeleting(null);
        notifySuccess(`Moved ${entryName(path)} to the trash`);
      },
      (error: unknown) => {
        setDeleting(null);
        notifyFailure(`${entryName(path)} was not deleted`, error);
      },
    );
  };

  const deletingChanged =
    deleting != null && [...changed].some((path) => isWithin(path, deleting));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 px-2 pt-2 pb-1">
        {/* The tree only knows the folders opened so far, so finding a file is a server search. */}
        <button
          type="button"
          onClick={openQuickOpen}
          className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-xl bg-input/50 px-2 text-left text-[12px] text-muted-foreground transition-colors hover:bg-input/80"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Go to file…</span>
          <Kbd className="shrink-0">{quickOpenKeys()}</Kbd>
        </button>
        {hidden.size > 0 && (
          <Button
            size="icon-sm"
            variant={showHidden ? 'secondary' : 'ghost'}
            aria-pressed={showHidden}
            aria-label={
              showHidden
                ? 'Stop showing hidden files'
                : `Show ${hidden.size} hidden`
            }
            title={
              showHidden
                ? 'Showing hidden files'
                : `${hidden.size} hidden in Files. Show them`
            }
            className="w-auto gap-1 px-1.5 text-[11px] text-muted-foreground"
            onClick={() => setShowHidden((current) => !current)}
          >
            {showHidden ? (
              <Eye className="size-3.5" />
            ) : (
              <EyeOff className="size-3.5" />
            )}
            {hidden.size}
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground"
          aria-label="New file"
          title="New file"
          onClick={() => void startCreate('file', '')}
        >
          <FilePlus />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground"
          aria-label="New folder"
          title="New folder"
          onClick={() => void startCreate('directory', '')}
        >
          <FolderPlus />
        </Button>
      </div>

      <FileTree
        model={model}
        data-slot="file-tree"
        // The open file reads as the active row, like History's; Pierre's own tint of the accent is nearly invisible here.
        className="min-h-0 flex-1 [--trees-selected-bg-override:var(--accent)]"
        renderContextMenu={(item, context) => {
          const folder = item.kind === 'directory';
          const path = folder ? withSlash(item.path) : item.path;
          const hiddenEntry = hiddenBy(path, hidden);
          const link = links.get(path);
          const hideAction: MenuAction =
            hiddenEntry == null
              ? {
                  label: folder ? 'Hide folder' : 'Hide file',
                  icon: EyeOff,
                  run: () => hide(path),
                }
              : {
                  label:
                    hiddenEntry === path
                      ? folder
                        ? 'Show folder'
                        : 'Show file'
                      : `Show ${entryName(hiddenEntry)}`,
                  icon: Eye,
                  run: () => show(hiddenEntry),
                };
          const copyActions: MenuAction[] = [
            {
              label: 'Copy relative path',
              icon: Copy,
              run: () => copyText(path, 'relative path'),
            },
            {
              label: 'Copy full path',
              icon: Copy,
              run: () => copyText(`${worktreePath}/${path}`, 'full path'),
            },
          ];
          // A symlink or submodule is not followed: nothing to open, rename or create inside.
          const actions: MenuAction[] =
            link != null
              ? [
                  hideAction,
                  'separator',
                  ...copyActions,
                  'separator',
                  {
                    label:
                      link.kind === 'symlink'
                        ? 'Delete symlink'
                        : 'Delete submodule',
                    icon: Trash2,
                    run: () => setDeleting(path),
                    destructive: true,
                  },
                ]
              : [
                  ...(folder
                    ? [
                        {
                          label: 'New file',
                          icon: FilePlus,
                          run: () => void startCreate('file', path),
                        },
                        {
                          label: 'New folder',
                          icon: FolderPlus,
                          run: () => void startCreate('directory', path),
                        },
                        'separator' as const,
                      ]
                    : [
                        {
                          label: changed.has(path) ? 'Open diff' : 'Open',
                          icon: changed.has(path) ? FileDiff : FileCode,
                          run: () => onOpen(refFor(path)),
                        },
                        ...(changed.has(path)
                          ? [
                              {
                                label: 'Open file',
                                icon: FileCode,
                                run: () => onOpen({ kind: 'file', path }),
                              },
                            ]
                          : []),
                        'separator' as const,
                      ]),
                  {
                    label: 'Rename',
                    icon: Pencil,
                    run: () => model.startRenaming(path),
                  },
                  hideAction,
                  'separator',
                  ...copyActions,
                  'separator',
                  {
                    label: folder ? 'Delete folder' : 'Delete file',
                    icon: Trash2,
                    run: () => setDeleting(path),
                    destructive: true,
                  },
                ];
          return (
            <div
              data-file-tree-context-menu-root="true"
              role="menu"
              ref={(menu) => placeMenu(menu, context.anchorRect)}
              style={{
                position: 'fixed',
                top: context.anchorRect.bottom + 4,
                left: context.anchorRect.left,
              }}
              className="z-50 min-w-48 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
            >
              {actions.map((action, index) =>
                action === 'separator' ? (
                  <hr
                    key={`separator-before-${(actions[index + 1] as { label?: string } | undefined)?.label}`}
                    className="-mx-1 my-1 border-border"
                  />
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
                        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-accent',
                        action.destructive &&
                          'text-destructive hover:bg-destructive/10',
                      )}
                    >
                      <action.icon
                        className={cn(
                          'size-3.5',
                          action.destructive
                            ? 'text-destructive'
                            : 'text-muted-foreground',
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

      <AlertDialog
        open={deleting != null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Move {deleting == null ? '' : entryName(deleting)} to the trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingChanged
                ? 'This is part of the agent’s changes. Deleting it changes what you are reviewing, and the agent may write it again.'
                : 'You can restore it from the system trash.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleting == null || removeEntry.isPending}
              onClick={() => deleting != null && confirmDelete(deleting)}
            >
              {removeEntry.isPending ? <Spinner /> : <Trash2 />}
              Move to trash
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
