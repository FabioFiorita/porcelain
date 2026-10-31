import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { GitStatusEntry } from '@pierre/trees';
import { useHotkey } from '@tanstack/react-hotkeys';
import {
  EyeOffIcon,
  FilePlusIcon,
  FolderPlusIcon,
  ListChevronsUpDownIcon,
  PlusIcon,
} from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { changePath } from '@porcelain/client/changes/rules';
import { useReviewOverview } from '@/features/changes/index';
import {
  canonicalPreferencePath,
  hiddenPathFor,
  hiddenSummary,
  visibleFileTreePaths,
} from '@porcelain/client/files/rules';
import {
  useHiddenPaths,
  usePinnedPaths,
  useSetHidden,
  useSetPinned,
} from '@/features/projects/index';
import { discardRejection } from '@/shared/lib/submit-form';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import {
  useFileTreeControls,
  useFileNavigationState,
  type PierreFileTreeInput,
} from '../store';
import { PierreFileTree } from '../adapters/pierre-file-tree';
import { useEditFile } from '../commands/edit-file';
import { runFileTreeAction } from '../commands/tree-menu';
import { useDirectories, useDirectory } from '../queries/directory';
import {
  fileErrorMessage,
  surfaceErrorMessage,
} from '@porcelain/client/files/rules';
import {
  changeStatus,
  fileTreeAncestors,
  mergeFileTreeEntries,
  pinnedFileEntries,
  pinnedParentDirectories,
  type PinnedDirectoryState,
} from '@porcelain/client/files/rules';
import type { FilesScope } from '@porcelain/client/files/rules';
import {
  duplicatePath,
  entryTreeActions,
  type TreeAction,
} from '@porcelain/client/files/rules';
import { FileTreeMenu } from './file-tree-menu';
import { PinnedFiles } from './pinned-files';
import { type Connection } from '@/shared/workspace/connection';

type Props = {
  scope: FilesScope;
  connection: Connection;
  worktreePath: string;
  selected: string;
  sideLabel: string;
  onOpen: (
    document: { kind: 'file' | 'change' | 'timeline'; path: string },
    anchor?: undefined,
    options?: { toSide?: boolean },
  ) => void;
  actionsTarget: HTMLElement | null;
};

export function FileNavigation({
  scope,
  connection,
  worktreePath,
  selected,
  onOpen,
  sideLabel,
  actionsTarget,
}: Props) {
  const scopeKey = `${connection.environmentId}:${scope.projectId}:${scope.worktreeId}`;
  return (
    <ScopedFileNavigation
      key={scopeKey}
      scope={scope}
      connection={connection}
      worktreePath={worktreePath}
      selected={selected}
      onOpen={onOpen}
      sideLabel={sideLabel}
      actionsTarget={actionsTarget}
    />
  );
}

function ScopedFileNavigation({
  scope,
  connection,
  worktreePath,
  selected,
  onOpen,
  sideLabel,
  actionsTarget,
}: Props) {
  const root = useDirectory(connection, scope, '');
  const edit = useEditFile(connection, scope);
  const editError = AsyncResult.isFailure(edit.result)
    ? Cause.squash(edit.result.cause)
    : undefined;
  const [creating, setCreating] = useState<{
    kind: 'file' | 'directory';
    folder: string;
    nonce: number;
  }>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const overview = Option.getOrUndefined(
    AsyncResult.value(useReviewOverview(scope, connection)),
  );
  const hidden = useHiddenPaths(connection, scope.projectId);
  const setHidden = useSetHidden(connection, scope.projectId);
  const pinned = usePinnedPaths(connection, scope.projectId);
  const setPinned = useSetPinned(connection, scope.projectId);
  const owner = `${connection.environmentId}:${scope.projectId}:${scope.worktreeId}`;
  const navigation = useFileNavigationState(owner);
  const {
    showHidden,
    query: fileQuery,
    requested,
    pinnedExpanded,
  } = navigation.state;
  const setShowHidden = (value: boolean) =>
    navigation.set((state) => ({ ...state, showHidden: value }));
  const setFileQuery = (query: string) =>
    navigation.set((state) => ({ ...state, query }));
  const setRequested = (
    update: (paths: readonly string[]) => readonly string[],
  ) =>
    navigation.set((state) => {
      const requested = update(state.requested);
      return requested === state.requested ? state : { ...state, requested };
    });
  const collapseLabel =
    fileQuery === '' ? 'Collapse all' : 'Clear search and collapse all';
  const pinParents = pinnedParentDirectories(
    pinned.map((path) => ({ path, pinned: true, hidden: false })),
  );
  const requestedPaths = union(
    union(union(requested, pinParents), ['']),
    fileTreeAncestors(selected),
  );

  const directoriesRead = useDirectories(connection, scope, requestedPaths);
  const directories = [
    root,
    ...directoriesRead.results.flatMap((result) =>
      Option.toArray(AsyncResult.value(result)),
    ),
  ];
  const entries = mergeFileTreeEntries(directories);
  const paths = entries.map((entry) => entry.path);
  const visiblePaths = visibleFileTreePaths(paths, hidden, showHidden);
  const kinds = new Map(entries.map((entry) => [entry.path, entry.kind]));
  const failed = directoriesRead.results.filter(AsyncResult.isFailure);
  const pinDirectories: PinnedDirectoryState[] = [
    { path: '', status: 'loaded', entries: root.entries },
    ...directoriesRead.states,
  ];
  const pins = pinnedFileEntries(
    visibleFileTreePaths(pinned, hidden, showHidden),
    pinDirectories,
  );
  const gitStatus: GitStatusEntry[] = [
    ...entries
      .filter((entry) => entry.ignored)
      .map((entry) => ({ path: entry.path, status: 'ignored' as const })),
    ...(overview?.changes ?? [])
      .flatMap((entry) => entry.comparisons)
      .map((change): GitStatusEntry => ({
        path: changePath(change),
        status: changeStatus(change),
      })),
  ];
  const changed = new Set<string>(
    (overview?.changes ?? []).map((entry) => entry.path),
  );
  const openable = new Set(
    entries.filter((entry) => entry.kind === 'file').map((entry) => entry.path),
  );

  const openFile = (path: string, toSide = false) =>
    onOpen({ kind: 'file', path }, undefined, { toSide });
  const duplicate = (path: string) =>
    edit.duplicate(
      path,
      duplicatePath(path, (candidate) => kinds.has(candidate)),
      openFile,
    );
  useHotkey(
    SHORTCUTS.duplicateFile,
    () => {
      if (!edit.result.waiting) duplicate(selected);
    },
    { enabled: openable.has(selected), ignoreInputs: true },
  );
  const onSelect = (path: string, toSide = false) => {
    const kind = kinds.get(path);
    if (kind === 'symlink' || kind === 'submodule')
      onOpen({ kind: 'file', path }, undefined, { toSide });
    else if (kind === 'file') openFile(path, toSide);
  };
  const { collapseAll, renameFile, bindCollapseAll, bindRename } =
    useFileTreeControls(owner);
  const menuFor = (path: string) => {
    const hiddenEntry = hiddenPathFor(path, hidden);
    const entry = entries.find(
      (entry) =>
        canonicalPreferencePath(entry.path) === canonicalPreferencePath(path),
    );
    return {
      hidden: hiddenEntry !== null,
      actions: entryTreeActions(entry, {
        changed: changed.has(path),
        openToSideLabel: sideLabel,
        hiddenEntry,
        ownHidden: hiddenEntry === canonicalPreferencePath(path),
        hiddenName: hiddenEntry?.replace(/\/$/, '').split('/').at(-1) ?? '',
        pinned:
          entry?.kind === 'file' || entry?.kind === 'directory'
            ? pinned.includes(canonicalPreferencePath(path))
            : undefined,
      }),
      run: (
        id: TreeAction,
        close: (restoreFocus: boolean) => void,
        rename: () => void,
      ) =>
        runFileTreeAction(id, {
          path,
          hiddenEntry,
          worktreePath,
          close,
          rename,
          onStartCreate: (kind, parent) => {
            if (!edit.result.waiting)
              setCreating({ kind, folder: parent, nonce: Date.now() });
          },
          onOpenFile: (next) => onOpen({ kind: 'file', path: next }),
          onOpenToSide: (next) => openFile(next, true),
          onOpenDiff: (next) => onOpen({ kind: 'change', path: next }),
          onOpenTimeline: (next) => onOpen({ kind: 'timeline', path: next }),
          onSetHidden: (next, value) =>
            discardRejection(setHidden.submit({ path: next, hidden: value })),
          onTogglePinned: (next) =>
            discardRejection(
              setPinned.submit({
                path: next,
                pinned: !pinned.includes(canonicalPreferencePath(next)),
              }),
            ),
          onTrash: setDeleting,
          onDuplicate: (next) => {
            if (!edit.result.waiting) duplicate(next);
          },
        }),
    };
  };

  const treeInput: PierreFileTreeInput = {
    owner,
    filter: fileQuery,
    onFilterChange: setFileQuery,
    paths: visiblePaths,
    kinds,
    links: entries.filter(
      (entry) => entry.kind === 'symlink' || entry.kind === 'submodule',
    ),
    creating,
    onCreate: (path, entryKind) =>
      edit.create(path, entryKind, (created) =>
        onOpen({ kind: 'file', path: created }),
      ),
    onMove: edit.move,
    gitStatus,
    selected,
    bindRename,
    bindCollapseAll,
    onInvalidName: (error) =>
      toast.add({ title: 'Invalid name', description: error, type: 'error' }),
    renderMenu: (item, context, rename) => {
      const path =
        item.kind === 'directory' && !item.path.endsWith('/')
          ? `${item.path}/`
          : item.path;
      const menu = menuFor(path);
      return (
        <FileTreeMenu
          key={path}
          path={path}
          finalFocus={context.finalFocus}
          actions={menu.actions}
          hidden={menu.hidden}
          onAction={(id) => menu.run(id, context.close, rename)}
        />
      );
    },
    onExpand: (paths) => setRequested((current) => union(current, paths)),
    onSelect,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 px-2 pt-2">
        <Input
          aria-label="Search files"
          placeholder="Search..."
          value={fileQuery}
          onChange={(event) => setFileQuery(event.target.value)}
          className="h-7 w-auto min-w-0 flex-1"
        />
      </div>
      {actionsTarget &&
        createPortal(
          <>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Create file or folder"
                          disabled={edit.result.waiting}
                        />
                      }
                    >
                      <PlusIcon className="text-muted-foreground" />
                    </DropdownMenuTrigger>
                  }
                />
                <TooltipContent role="tooltip" className="break-all">
                  Create file or folder
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    setCreating({
                      kind: 'file',
                      folder: '',
                      nonce: Date.now(),
                    })
                  }
                >
                  <FilePlusIcon />
                  New file
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setCreating({
                      kind: 'directory',
                      folder: '',
                      nonce: Date.now(),
                    })
                  }
                >
                  <FolderPlusIcon />
                  New folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={collapseLabel}
                    onClick={() => collapseAll()}
                  />
                }
              >
                <ListChevronsUpDownIcon className="text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent role="tooltip" className="break-all">
                {collapseLabel}
              </TooltipContent>
            </Tooltip>
          </>,
          actionsTarget,
        )}
      <PinnedFiles
        entries={pins}
        groupExpanded={navigation.state.pinnedGroupExpanded}
        onGroupExpand={(pinnedGroupExpanded) =>
          navigation.set((state) => ({ ...state, pinnedGroupExpanded }))
        }
        expanded={pinnedExpanded}
        onExpand={(path, expanded) => {
          navigation.set((state) => ({
            ...state,
            pinnedExpanded: expanded
              ? union(state.pinnedExpanded, [path])
              : state.pinnedExpanded.filter((entry) => entry !== path),
          }));
          if (expanded) setRequested((current) => union(current, [path]));
        }}
        onRetry={() => directoriesRead.retry()}
        renderDirectory={(path) => (
          <PinnedDirectoryTree prefix={`${path}/`} input={treeInput} />
        )}
        statuses={gitStatus}
        selected={selected}
        onOpen={openFile}
        onUnpin={(path) =>
          discardRejection(setPinned.submit({ path, pinned: false }))
        }
        menuFor={(path) => {
          const menu = menuFor(path);
          const resolved = pins.some(
            (pin) =>
              pin.path === canonicalPreferencePath(path) &&
              pin.state === 'resolved',
          );
          return {
            actions: resolved ? menu.actions : [],
            hidden: menu.hidden,
            onAction: (id) =>
              menu.run(
                id,
                () => undefined,
                () => renameFile(path),
              ),
          };
        }}
      />
      <section
        aria-label="All files"
        className="flex min-h-0 flex-1 flex-col pt-1"
      >
        <p className="px-3.5 pt-1 pb-0.5 text-2xs font-medium text-muted-foreground">
          All files
        </p>
        <PierreFileTree {...treeInput} />
        {hidden.size > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-2xs text-muted-foreground">
            <EyeOffIcon className="size-3.5 shrink-0" />
            <span>
              {hiddenSummary(
                hidden,
                (path) => kinds.get(path) ?? kinds.get(`${path}/`),
              )}
            </span>
            <span aria-hidden="true">·</span>
            <Button
              variant="link"
              size="xs"
              onClick={() => setShowHidden(!showHidden)}
            >
              {showHidden ? 'Hide' : 'Show'}
            </Button>
          </div>
        )}
      </section>
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !edit.result.waiting) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {deleting} to the trash?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting !== null &&
              deleting !== undefined &&
              changed.has(deleting)
                ? 'This is part of the agent’s changes. Deleting it changes what you are reviewing, and the agent may write it again. You can restore it from the system trash.'
                : 'You can restore it from the system trash. This changes the files in your worktree.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={edit.result.waiting}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={edit.result.waiting}
              onClick={() => {
                if (deleting) edit.trash(deleting, () => setDeleting(null));
              }}
            >
              Move to trash
            </Button>
          </AlertDialogFooter>
          {editError !== undefined && (
            <p role="alert" className="text-xs text-destructive">
              {fileErrorMessage(editError)}
            </p>
          )}
        </AlertDialogContent>
      </AlertDialog>
      {editError !== undefined && !deleting && (
        <p role="alert" className="px-3 py-2 text-xs text-destructive">
          {fileErrorMessage(editError)}
        </p>
      )}
      {AsyncResult.isFailure(setPinned.result) && (
        <p role="alert" className="border-t px-3 py-2 text-xs text-destructive">
          {surfaceErrorMessage(Cause.squash(setPinned.result.cause))}
        </p>
      )}
      {AsyncResult.isFailure(setHidden.result) && (
        <p role="alert" className="border-t px-3 py-2 text-xs text-destructive">
          {surfaceErrorMessage(Cause.squash(setHidden.result.cause))}
        </p>
      )}
      {failed.length > 0 && (
        <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1">
            Some folders could not be loaded.
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => directoriesRead.retry()}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

function union(left: readonly string[], right: readonly string[]) {
  const merged = [...new Set([...left, ...right])].sort();
  return merged.length === left.length &&
    merged.every((entry, index) => entry === left[index])
    ? left
    : merged;
}

function PinnedDirectoryTree({
  prefix,
  input,
}: {
  prefix: string;
  input: PierreFileTreeInput;
}) {
  const [height, setHeight] = useState(0);
  const relative = (path: string) => path.slice(prefix.length);
  const paths = input.paths.filter(
    (path) => path.startsWith(prefix) && path !== prefix,
  );
  return (
    <div className="flex max-h-52 min-h-0 flex-col pl-3" style={{ height }}>
      <PierreFileTree
        {...input}
        onContentHeight={setHeight}
        owner={`${input.owner}:pin:${prefix}`}
        paths={paths.map(relative)}
        kinds={
          new Map(
            paths.flatMap((path) => {
              const kind = input.kinds.get(path);
              return kind === undefined ? [] : [[relative(path), kind]];
            }),
          )
        }
        links={input.links
          .filter((entry) => entry.path.startsWith(prefix))
          .map((entry) => ({ ...entry, path: relative(entry.path) }))}
        gitStatus={input.gitStatus
          .filter((entry) => entry.path.startsWith(prefix))
          .map((entry) => ({ ...entry, path: relative(entry.path) }))}
        selected={
          input.selected.startsWith(prefix) ? relative(input.selected) : ''
        }
        creating={undefined}
        onCreate={(path, kind) => input.onCreate(`${prefix}${path}`, kind)}
        onMove={(from, to) =>
          input.onMove(`${prefix}${from}`, `${prefix}${to}`)
        }
        onSelect={(path, toSide) => input.onSelect(`${prefix}${path}`, toSide)}
        onExpand={(paths) =>
          input.onExpand(paths.map((path) => `${prefix}${path}`))
        }
        bindRename={() => undefined}
        bindCollapseAll={() => undefined}
        renderMenu={(item, context, rename) =>
          input.renderMenu(
            { ...item, path: `${prefix}${item.path}` },
            context,
            rename,
          )
        }
      />
    </div>
  );
}
