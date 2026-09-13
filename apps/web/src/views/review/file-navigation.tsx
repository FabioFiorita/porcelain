import type { GitStatusEntry } from '@pierre/trees';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  fileTreeAncestors,
  mergeFileTreeEntries,
} from '../../domain/file-tree';
import { changePath, type ReviewScope } from '../../domain/review';
import { useChanges, useDirectories, useDirectory } from '../../query/review';
import { PierreFileTree } from './pierre-file-tree';

type Props = {
  scope: ReviewScope;
  selected: string;
  onSelect: (path: string) => void;
};

export function FileNavigation({ scope, selected, onSelect }: Props) {
  const scopeKey = `${scope.projectId}:${scope.worktreeId}`;
  return (
    <ScopedFileNavigation
      key={scopeKey}
      scope={scope}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

function ScopedFileNavigation({ scope, selected, onSelect }: Props) {
  const root = useDirectory(scope, '');
  const { status } = useChanges(scope);
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
  const entries = mergeFileTreeEntries(directories);
  const paths = useStableList(entries.map((entry) => entry.path));
  const kinds = useMemo(
    () => new Map(entries.map((entry) => [entry.path, entry.kind])),
    [entries],
  );
  const failed = queries.filter((query) => query.isError);
  const gitStatus = useMemo<GitStatusEntry[]>(
    () =>
      status.changes.map((change) => ({
        path: changePath(change),
        status:
          change.scope === 'untracked'
            ? 'untracked'
            : change.scope === 'unmerged' || change.kind === 'type-changed'
              ? 'modified'
              : change.kind,
      })),
    [status.changes],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PierreFileTree
        paths={paths}
        gitStatus={gitStatus}
        selected={selected}
        onExpand={(paths) => setRequested((current) => union(current, paths))}
        onSelect={(path) => {
          if (kinds.get(path) === 'file') onSelect(path);
        }}
      />
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
