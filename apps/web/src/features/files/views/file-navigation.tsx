import type { GitStatusEntry } from '@pierre/trees';
import { useHotkey } from '@tanstack/react-hotkeys';
import {
  EyeIcon,
  EyeOffIcon,
  FilePlusIcon,
  FolderPlusIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { toast } from '@/components/ui/toast';
import { useAccessStore } from '@/features/access/index';
import { changePath, useReviewOverview } from '@/features/changes/index';
import {
  canonicalPreferencePath,
  hiddenPathFor,
  useHiddenPaths,
  usePinnedPaths,
  useSetHidden,
  useSetPinned,
  visibleFileTreePaths,
} from '@/features/projects/index';
import { discardRejection } from '@/shared/lib/submit-form';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { PierreFileTree } from '../adapters/pierre-file-tree';
import { useEditFile } from '../commands/edit-file';
import { runFileTreeAction } from '../commands/tree-menu';
import { useDirectories, useDirectory } from '../queries/directory';
import { fileErrorMessage, surfaceErrorMessage } from '../rules/error-message';
import { fileTreeAncestors, mergeFileTreeEntries } from '../rules/file-tree';
import { isImagePath } from '../rules/html-assets';
import type { FilesScope } from '../rules/scope';
import { duplicatePath, treeActions } from '../rules/tree-actions';
import { FileTreeMenu } from './file-tree-menu';
import { PinnedFiles } from './pinned-files';
import { QuickOpen } from './quick-open';

type Props = {
  scope: FilesScope;
  worktreePath: string;
  selected: string;
  onOpen: (document: { kind: 'file' | 'change'; path: string }) => void;
};

export function FileNavigation({
  scope,
  worktreePath,
  selected,
  onOpen,
}: Props) {
  const scopeKey = `${scope.projectId}:${scope.worktreeId}`;
  return (
    <ScopedFileNavigation
      key={scopeKey}
      scope={scope}
      worktreePath={worktreePath}
      selected={selected}
      onOpen={onOpen}
    />
  );
}

function ScopedFileNavigation({
  scope,
  worktreePath,
  selected,
  onOpen,
}: Props) {
  const connection = useAccessStore((state) => state.connection);
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
  const [requested, setRequested] = useState<readonly string[]>(() =>
    fileTreeAncestors(selected),
  );
  useEffect(() => {
    setRequested((current) => union(current, fileTreeAncestors(selected)));
  }, [selected]);

  const queries = useDirectories(connection, scope, requested);
  const directories = [
    root,
    ...queries.flatMap((query) => (query.data ? [query.data] : [])),
  ];
  const entries = mergeFileTreeEntries(directories);
  const paths = entries.map((entry) => entry.path);
  const visiblePaths = visibleFileTreePaths(paths, hidden, showHidden);
  const kinds = new Map(entries.map((entry) => [entry.path, entry.kind]));
  const failed = queries.filter((query) => query.isError);
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 px-2 pt-2 pb-1">
        <QuickOpen
          scope={scope}
          onOpen={(path) => {
            setRequested((current) => union(current, fileTreeAncestors(path)));
            onOpen({ kind: 'file', path });
          }}
        />
        {hidden.size > 0 && (
          <Button
            size="sm"
            variant={showHidden ? 'secondary' : 'ghost'}
            aria-pressed={showHidden}
            className="h-6"
            onClick={() => setShowHidden((current) => !current)}
          >
            {showHidden ? (
              <EyeIcon className="size-3.5" />
            ) : (
              <EyeOffIcon className="size-3.5" />
            )}
            {showHidden ? 'Showing hidden' : `Hidden (${hidden.size})`}
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
      />
      <PierreFileTree
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
          const hiddenEntry = hiddenPathFor(path, hidden);
          const actions = treeActions({
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
          });
          return (
            <FileTreeMenu
              path={path}
              anchor={context.anchorRect}
              actions={actions}
              hidden={hiddenEntry !== null}
              onMenuKeyDown={onMenuKeyDown}
              onAction={(id) =>
                runFileTreeAction(id, {
                  path,
                  hiddenEntry,
                  worktreePath,
                  close: (restoreFocus) => context.close({ restoreFocus }),
                  rename,
                  onStartCreate: (kind, folder) => {
                    if (!edit.isPending)
                      setCreating({ kind, folder, nonce: Date.now() });
                  },
                  onOpenFile: (path) => onOpen({ kind: 'file', path }),
                  onOpenDiff: (path) => onOpen({ kind: 'change', path }),
                  onSetHidden: (path, value) =>
                    discardRejection(setHidden.submit({ path, hidden: value })),
                  onTogglePinned: (path) =>
                    discardRejection(
                      setPinned.submit({
                        path,
                        pinned: !pinned.includes(path),
                      }),
                    ),
                  onTrash: setDeleting,
                  onDuplicate: (path) => {
                    if (!edit.isPending) duplicate(path);
                  },
                })
              }
            />
          );
        }}
        onExpand={(paths) => setRequested((current) => union(current, paths))}
        onSelect={onSelect}
      />
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
      {setPinned.error && (
        <p role="alert" className="border-t px-3 py-2 text-xs text-destructive">
          {surfaceErrorMessage(setPinned.error)}
        </p>
      )}
      {setHidden.error && (
        <p role="alert" className="border-t px-3 py-2 text-xs text-destructive">
          {surfaceErrorMessage(setHidden.error)}
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
            onClick={() => {
              for (const query of failed) void query.refetch();
            }}
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
