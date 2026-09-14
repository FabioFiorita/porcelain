import type { GitStatusEntry } from '@pierre/trees';
import {
  EyeIcon,
  EyeOffIcon,
  FilePlusIcon,
  FolderPlusIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { DocumentRef } from '../../domain/documents';
import { visibleFileTreePaths } from '../../domain/file-preferences';
import {
  fileTreeAncestors,
  mergeFileTreeEntries,
} from '../../domain/file-tree';
import { changePath, type ReviewScope } from '../../domain/review';
import { discardRejection } from '../../lib/submit-form';
import { useHiddenPaths, useSetHidden } from '../../query/file-preferences';
import { useEditFile } from '../../query/files';
import {
  reviewErrorMessage,
  useDirectories,
  useDirectory,
  useFileTree,
  useReviewOverview,
} from '../../query/review';
import { PierreFileTree } from './pierre-file-tree';

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
  const root = useDirectory(scope, '');
  const tree = useFileTree(scope);
  const treeEntries = useMemo(() => tree.data?.entries ?? [], [tree.data]);
  const edit = useEditFile(scope);
  const [creating, setCreating] = useState<{
    kind: 'file' | 'directory';
    folder: string;
    nonce: number;
  }>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const overview = useReviewOverview(scope);
  const hidden = useHiddenPaths(scope.projectId);
  const setHidden = useSetHidden(scope.projectId);
  const [showHidden, setShowHidden] = useState(false);
  const [requested, setRequested] = useState<readonly string[]>(() =>
    fileTreeAncestors(selected),
  );
  useEffect(() => {
    setRequested((current) => union(current, fileTreeAncestors(selected)));
  }, [selected]);

  const queries = useDirectories(scope, requested);
  const directories = [
    root,
    ...queries.flatMap((query) => (query.data ? [query.data] : [])),
  ];
  const special = new Set(
    treeEntries
      .filter((entry) => entry.kind === 'submodule')
      .map((entry) => `${entry.path}/`),
  );
  const entries = [
    ...new Map(
      [
        ...mergeFileTreeEntries(directories).filter(
          (entry) => !special.has(entry.path),
        ),
        ...treeEntries,
      ].map((entry) => [entry.path, entry]),
    ).values(),
  ];
  const paths = useStableList(entries.map((entry) => entry.path));
  const visiblePaths = useStableList(
    visibleFileTreePaths(paths, hidden, showHidden),
  );
  const kinds = new Map(entries.map((entry) => [entry.path, entry.kind]));
  const failed = queries.filter((query) => query.isError);
  const gitStatus = useMemo<GitStatusEntry[]>(
    () => [
      ...treeEntries
        .filter((entry) => entry.ignored)
        .map((entry) => ({ path: entry.path, status: 'ignored' as const })),
      ...(overview?.status.changes ?? []).map(
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
    [overview?.status.changes, treeEntries],
  );
  const changed = useMemo(
    () => new Set((overview?.status.changes ?? []).map(changePath)),
    [overview?.status.changes],
  );
  const openable = new Set(
    entries.filter((entry) => entry.kind === 'file').map((entry) => entry.path),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b px-3">
        <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {tree.isPending
            ? 'Loading files…'
            : `${visiblePaths.filter((path) => !path.endsWith('/')).length} files`}{' '}
          · {changed.size} changed
        </p>
        {hidden.size > 0 && (
          <Button
            size="sm"
            variant={showHidden ? 'secondary' : 'ghost'}
            aria-pressed={showHidden}
            className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
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
          <FilePlusIcon />
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
          <FolderPlusIcon />
        </Button>
      </div>
      <PierreFileTree
        paths={visiblePaths}
        links={treeEntries.filter(
          (entry) => entry.kind === 'symlink' || entry.kind === 'submodule',
        )}
        creating={creating}
        onStartCreate={(kind, folder) => {
          if (!edit.isPending) setCreating({ kind, folder, nonce: Date.now() });
        }}
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
        onTrash={setDeleting}
        gitStatus={gitStatus}
        selected={selected}
        hidden={hidden}
        changed={changed}
        openable={openable}
        worktreePath={worktreePath}
        onExpand={(paths) => setRequested((current) => union(current, paths))}
        onSelect={(path) => {
          if (kinds.get(path) === 'file')
            onOpen({ kind: changed.has(path) ? 'change' : 'file', path });
        }}
        onOpenFile={(path) => onOpen({ kind: 'file', path })}
        onSetHidden={(path, value) =>
          discardRejection(setHidden.submit({ path, hidden: value }))
        }
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
              You can restore it from the system trash. This changes the files
              in your worktree.
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
              {reviewErrorMessage(edit.error)}
            </p>
          )}
        </AlertDialogContent>
      </AlertDialog>
      {edit.error && !deleting && (
        <p role="alert" className="px-3 py-2 text-xs text-destructive">
          {reviewErrorMessage(edit.error)}
        </p>
      )}
      {setHidden.error && (
        <p role="alert" className="border-t px-3 py-2 text-xs text-destructive">
          {reviewErrorMessage(setHidden.error)}
        </p>
      )}
      {tree.isError && (
        <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1">
            Full file search could not be loaded. You can still browse folders.
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => void tree.refetch()}
          >
            Try again
          </Button>
        </div>
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
  const stable = useRef(value);
  if (
    value.length !== stable.current.length ||
    value.some((entry, index) => entry !== stable.current[index])
  )
    stable.current = value;
  return stable.current;
}
