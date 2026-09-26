import type { GitStatusEntry } from '@pierre/trees';
import {
  EyeIcon,
  EyeOffIcon,
  FilePlusIcon,
  FolderPlusIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import type { DocumentRef } from '@/features/review/model/documents';
import {
  canonicalPreferencePath,
  hiddenPathFor,
  visibleFileTreePaths,
} from '@/features/projects/index';
import { useAccessStore } from '@/features/access/index';
import { useReviewOverview } from '@/features/changes/index';
import {
  fileTreeAncestors,
  mergeFileTreeEntries,
  isImagePath,
  useDirectories,
  useDirectory,
  fileErrorMessage,
  PierreFileTree,
  FileTreeMenu,
  treeActions,
  runFileTreeAction,
} from '@/features/files/index';
import {
  changePath,
  comparisons,
  type ReviewScope,
} from '@/features/review/model/review';
import { discardRejection } from '@/shared/lib/submit-form';
import { useHiddenPaths, useSetHidden } from '@/features/projects/index';
import { useEditFile } from '@/features/files/index';
import { reviewErrorMessage } from '@/features/review/queries/review';
import { QuickOpen } from '@/features/files/index';

type Props = {
  scope: ReviewScope;
  worktreePath: string;
  selected: string;
  onOpen: (document: DocumentRef) => void;
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
  const paths = useStableList(entries.map((entry) => entry.path));
  const visiblePaths = useStableList(
    visibleFileTreePaths(paths, hidden, showHidden),
  );
  const kinds = new Map(entries.map((entry) => [entry.path, entry.kind]));
  const failed = queries.filter((query) => query.isError);
  const gitStatus = useMemo<GitStatusEntry[]>(
    () => [
      ...entries
        .filter((entry) => entry.ignored)
        .map((entry) => ({ path: entry.path, status: 'ignored' as const })),
      ...(overview ? comparisons(overview.changes) : []).map(
        (change): GitStatusEntry => ({
          path: changePath(change),
          status:
            change.scope === 'untracked'
              ? 'untracked'
              : change.scope === 'unmerged' || change.kind === 'type-changed'
                ? 'modified'
                : change.kind,
        }),
      ),
    ],
    [overview, entries],
  );
  const changed = useMemo(
    () =>
      new Set<string>(
        (overview?.changes.changes ?? []).map((entry) => entry.path),
      ),
    [overview?.changes.changes],
  );
  const openable = new Set(
    entries.filter((entry) => entry.kind === 'file').map((entry) => entry.path),
  );

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
      <PierreFileTree
        paths={visiblePaths}
        links={entries.filter(
          (entry) => entry.kind === 'symlink' || entry.kind === 'submodule',
        )}
        creating={creating}
        onCreate={async (path, entryKind) => {
          await edit.submit({
            kind: 'create',
            path: path.replace(/\/$/, ''),
            entryKind,
          });
          if (entryKind === 'file') onOpen({ kind: 'file', path });
        }}
        onMove={async (path, destination) => {
          await edit.submit({
            kind: 'move',
            path: path.replace(/\/$/, ''),
            destination: destination.replace(/\/$/, ''),
          });
        }}
        gitStatus={gitStatus}
        selected={selected}
        onInvalidName={(error) =>
          toast.add({
            title: 'Invalid name',
            description: error,
            type: 'error',
          })
        }
        renderMenu={(item, context, rename) => {
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
          });
          return (
            <FileTreeMenu
              path={path}
              anchor={context.anchorRect}
              actions={actions}
              hidden={hiddenEntry !== null}
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
                  onTrash: setDeleting,
                })
              }
            />
          );
        }}
        onExpand={(paths) => setRequested((current) => union(current, paths))}
        onSelect={(path) => {
          const kind = kinds.get(path);
          if (kind === 'symlink' || kind === 'submodule')
            onOpen({ kind: 'file', path });
          else if (kind === 'file')
            onOpen({
              kind:
                changed.has(path) &&
                !isImagePath(path) &&
                !/\.html?$/i.test(path)
                  ? 'change'
                  : 'file',
              path,
            });
        }}
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
                if (deleting)
                  void edit
                    .submit({
                      kind: 'trash',
                      path: deleting.replace(/\/$/, ''),
                    })
                    .then(() => setDeleting(null))
                    .catch(() => undefined);
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
      {setHidden.error && (
        <p role="alert" className="border-t px-3 py-2 text-xs text-destructive">
          {reviewErrorMessage(setHidden.error)}
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

function useStableList(value: readonly string[]) {
  const key = value.join('\0');
  return useMemo(() => value, [key]);
}
