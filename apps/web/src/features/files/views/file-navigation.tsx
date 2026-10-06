import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { GitStatusEntry } from '@pierre/trees';
import { useHotkey } from '@tanstack/react-hotkeys';
import {
  EyeIcon,
  EyeOffIcon,
  FilePlusIcon,
  FolderPlusIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
import { toast } from '@/components/ui/toast';
import { changePath } from '@porcelain/client/changes/rules';
import { useReviewOverview } from '@/features/changes/index';
import {
  canonicalPreferencePath,
  hiddenPathFor,
  visibleFileTreePaths,
} from '@porcelain/client/projects/rules';
import {
  useHiddenPaths,
  usePinnedPaths,
  useSetHidden,
  useSetPinned,
} from '@/features/projects/index';
import { discardRejection } from '@/shared/lib/submit-form';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { PierreFileTree } from '../adapters/pierre-file-tree';
import { useEditFile } from '../commands/edit-file';
import { runFileTreeAction } from '../commands/tree-menu';
import { useDirectories, useDirectory } from '../queries/directory';
import {
  fileErrorMessage,
  surfaceErrorMessage,
} from '@porcelain/client/files/rules';
import {
  fileTreeAncestors,
  mergeFileTreeEntries,
} from '@porcelain/client/files/rules';
import { isImagePath } from '../rules/html-assets';
import type { FilesScope } from '@porcelain/client/files/rules';
import {
  duplicatePath,
  treeActions,
  type TreeAction,
} from '@porcelain/client/files/rules';
import { FileTreeMenu } from './file-tree-menu';
import { PinnedFiles } from './pinned-files';
import { QuickOpen } from './quick-open';
import { type Connection } from '@/shared/workspace/connection';

type Props = {
  scope: FilesScope;
  connection: Connection;
  worktreePath: string;
  selected: string;
  onOpen: (document: {
    kind: 'file' | 'change' | 'timeline';
    path: string;
  }) => void;
};

export function FileNavigation({
  scope,
  connection,
  worktreePath,
  selected,
  onOpen,
}: Props) {
  const scopeKey = `${scope.projectId}:${scope.worktreeId}`;
  return (
    <ScopedFileNavigation
      key={scopeKey}
      scope={scope}
      connection={connection}
      worktreePath={worktreePath}
      selected={selected}
      onOpen={onOpen}
    />
  );
}

function ScopedFileNavigation({
  scope,
  connection,
  worktreePath,
  selected,
  onOpen,
}: Props) {
  const root = useDirectory(connection, scope, '');
  const edit = useEditFile(connection, scope);
  const [creating, setCreating] = useState<{
    kind: 'file' | 'directory';
    folder: string;
    nonce: number;
  }>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const overview = useReviewOverview(scope, connection);
  const hidden = useHiddenPaths(connection, scope.projectId);
  const setHidden = useSetHidden(connection, scope.projectId);
  const pinned = usePinnedPaths(connection, scope.projectId);
  const setPinned = useSetPinned(connection, scope.projectId);
  const [showHidden, setShowHidden] = useState(false);
  const [fileQuery, setFileQuery] = useState('');
  const [requested, setRequested] = useState<readonly string[]>(() =>
    fileTreeAncestors(selected),
  );
  useEffect(() => {
    setRequested((current) => union(current, fileTreeAncestors(selected)));
  }, [selected]);

  const directoriesRead = useDirectories(connection, scope, requested);
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
  const gitStatus: GitStatusEntry[] = [
    ...entries
      .filter((entry) => entry.ignored)
      .map((entry) => ({ path: entry.path, status: 'ignored' as const })),
    ...(overview?.changes.changes ?? [])
      .flatMap((entry) => entry.comparisons)
      .map((change): GitStatusEntry => ({
        path: changePath(change),
        status:
          change.scope === 'untracked'
            ? 'untracked'
            : change.scope === 'unmerged' || change.kind === 'type-changed'
              ? 'modified'
              : change.kind,
      })),
  ];
  const changed = new Set<string>(
    (overview?.changes.changes ?? []).map((entry) => entry.path),
  );
  const openable = new Set(
    entries.filter((entry) => entry.kind === 'file').map((entry) => entry.path),
  );

  const openFile = (path: string) =>
    onOpen({
      kind:
        changed.has(path) && !isImagePath(path) && !/\.html?$/i.test(path)
          ? 'change'
          : 'file',
      path,
    });
  const duplicate = (path: string) =>
    edit.duplicate(
      path,
      duplicatePath(path, (candidate) => kinds.has(candidate)),
      openFile,
    );
  useHotkey(
    SHORTCUTS.duplicateFile,
    () => {
      if (!edit.isPending) duplicate(selected);
    },
    { enabled: openable.has(selected), ignoreInputs: true },
  );
  const onSelect = (path: string) => {
    const kind = kinds.get(path);
    if (kind === 'symlink' || kind === 'submodule')
      onOpen({ kind: 'file', path });
    else if (kind === 'file') openFile(path);
  };
  const renameFile = useRef<(path: string) => void>(() => undefined);
  const bindRename = (rename: (path: string) => void) => {
    renameFile.current = rename;
  };
  const menuFor = (path: string, folder: boolean) => {
    const hiddenEntry = hiddenPathFor(path, hidden);
    return {
      hidden: hiddenEntry !== null,
      actions: treeActions({
        folder,
        link: entries.some(
          (entry) =>
            entry.path === path &&
            (entry.kind === 'symlink' || entry.kind === 'submodule'),
        ),
        changed: changed.has(path),
        openable: openable.has(path),
        hiddenEntry,
        ownHidden: hiddenEntry === canonicalPreferencePath(path),
        hiddenName: hiddenEntry?.replace(/\/$/, '').split('/').at(-1) ?? '',
        pinned: openable.has(path) ? pinned.includes(path) : undefined,
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
            if (!edit.isPending)
              setCreating({ kind, folder: parent, nonce: Date.now() });
          },
          onOpenFile: (next) => onOpen({ kind: 'file', path: next }),
          onOpenDiff: (next) => onOpen({ kind: 'change', path: next }),
          onOpenTimeline: (next) => onOpen({ kind: 'timeline', path: next }),
          onSetHidden: (next, value) =>
            discardRejection(setHidden.submit({ path: next, hidden: value })),
          onTogglePinned: (next) =>
            discardRejection(
              setPinned.submit({
                path: next,
                pinned: !pinned.includes(next),
              }),
            ),
          onTrash: setDeleting,
          onDuplicate: (next) => {
            if (!edit.isPending) duplicate(next);
          },
        }),
    };
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <QuickOpen
        scope={scope}
        connection={connection}
        onOpen={(path) => {
          setRequested((current) => union(current, fileTreeAncestors(path)));
          onOpen({ kind: 'file', path });
        }}
      />
      <div className="flex shrink-0 items-center gap-1 px-2 pt-2">
        <Input
          aria-label="Search files"
          placeholder="Search..."
          value={fileQuery}
          onChange={(event) => setFileQuery(event.target.value)}
          className="h-7 w-auto min-w-0 flex-1"
        />
        {hidden.size > 0 && (
          <Button
            size="icon-sm"
            variant={showHidden ? 'secondary' : 'ghost'}
            aria-pressed={showHidden}
            aria-label={
              showHidden ? 'Showing hidden' : `Hidden (${hidden.size})`
            }
            onClick={() => setShowHidden((current) => !current)}
          >
            {showHidden ? (
              <EyeIcon className="text-muted-foreground" />
            ) : (
              <EyeOffIcon className="text-muted-foreground" />
            )}
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="New file"
          disabled={edit.isPending}
          onClick={() =>
            setCreating({ kind: 'file', folder: '', nonce: Date.now() })
          }
        >
          <FilePlusIcon className="text-muted-foreground" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="New folder"
          disabled={edit.isPending}
          onClick={() =>
            setCreating({ kind: 'directory', folder: '', nonce: Date.now() })
          }
        >
          <FolderPlusIcon className="text-muted-foreground" />
        </Button>
      </div>
      <PinnedFiles
        paths={pinned}
        selected={selected}
        onOpen={openFile}
        onUnpin={(path) =>
          discardRejection(setPinned.submit({ path, pinned: false }))
        }
        menuFor={(path) => {
          const menu = menuFor(path, false);
          return {
            actions: menu.actions,
            hidden: menu.hidden,
            onAction: (id) =>
              menu.run(
                id,
                () => undefined,
                () => renameFile.current(path),
              ),
          };
        }}
      />
      <section
        aria-label="All files"
        className="flex min-h-0 flex-1 flex-col pt-1"
      >
        <p className="px-3.5 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground">
          All files
        </p>
        <PierreFileTree
          filter={fileQuery}
          onFilterChange={setFileQuery}
          paths={visiblePaths}
          links={entries.filter(
            (entry) => entry.kind === 'symlink' || entry.kind === 'submodule',
          )}
          creating={creating}
          onCreate={(path, entryKind) =>
            edit.create(path, entryKind, (created) =>
              onOpen({ kind: 'file', path: created }),
            )
          }
          onMove={edit.move}
          gitStatus={gitStatus}
          selected={selected}
          bindRename={bindRename}
          onInvalidName={(error) =>
            toast.add({
              title: 'Invalid name',
              description: error,
              type: 'error',
            })
          }
          renderMenu={(item, context, rename, onMenuKeyDown) => {
            const folder = item.kind === 'directory';
            const path =
              folder && !item.path.endsWith('/') ? `${item.path}/` : item.path;
            const menu = menuFor(path, folder);
            return (
              <FileTreeMenu
                path={path}
                anchor={context.anchorElement}
                actions={menu.actions}
                hidden={menu.hidden}
                onMenuKeyDown={onMenuKeyDown}
                onAction={(id) =>
                  menu.run(
                    id,
                    (restoreFocus) => context.close({ restoreFocus }),
                    rename,
                  )
                }
              />
            );
          }}
          onExpand={(paths) => setRequested((current) => union(current, paths))}
          onSelect={onSelect}
        />
      </section>
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !edit.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {deleting} to the trash?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting != null && changed.has(deleting)
                ? 'This is part of the agent’s changes. Deleting it changes what you are reviewing, and the agent may write it again. You can restore it from the system trash.'
                : 'You can restore it from the system trash. This changes the files in your worktree.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={edit.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={edit.isPending}
              onClick={() => {
                if (deleting) edit.trash(deleting, () => setDeleting(null));
              }}
            >
              Move to trash
            </Button>
          </AlertDialogFooter>
          {edit.error && (
            <p role="alert" className="text-xs text-destructive">
              {fileErrorMessage(edit.error)}
            </p>
          )}
        </AlertDialogContent>
      </AlertDialog>
      {edit.error && !deleting && (
        <p role="alert" className="px-3 py-2 text-xs text-destructive">
          {fileErrorMessage(edit.error)}
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
