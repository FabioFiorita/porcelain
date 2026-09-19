import { useMemo } from 'react';
import type { GitChange } from '../../contracts/git-status';
import {
  diffSelection,
  type ListedChange,
  listChanges,
  type ReviewScope,
} from '../../domain/review';
import { useChanges, useDiffs } from '../../query/review';
import {
  type BinaryEntry,
  binaryEntry,
  type DiffEntry,
  diffEntry,
} from './diff-entries';
import type { LineSpan } from './patch-focus';

/** One file to show from the list of changes, optionally cut down to some lines. */
export type ChangeRequest = {
  path: string;
  note?: string;
  focus?: readonly LineSpan[];
};

/**
 * Diff entries for some changed files, in the order asked. Each diff is its own
 * read, keyed by the file's fingerprint; untracked files diff against nothing.
 * Binary files come back apart, with no lines to show; conflicted files have no
 * diff read and are left out. A staged file's header says so, unless the request
 * brings its own note.
 */
export function useChangeEntries(
  scope: ReviewScope,
  requests: readonly ChangeRequest[],
) {
  const { changes } = useChanges(scope);
  const selected = useMemo(() => {
    const byPath = new Map(
      listChanges(changes).map((listed) => [listed.path, listed]),
    );
    return requests.flatMap(
      (
        request,
      ): {
        request: ChangeRequest;
        change: GitChange;
        staged: ListedChange['staged'];
      }[] => {
        const listed = byPath.get(request.path);
        return listed == null || diffSelection(listed.change) == null
          ? []
          : [{ request, change: listed.change, staged: listed.staged }];
      },
    );
  }, [changes, requests]);
  const responses = useDiffs(
    scope,
    selected.map((entry) => entry.change),
  );
  const entries: DiffEntry[] = [];
  const binaries: BinaryEntry[] = [];
  responses.forEach((response, index) => {
    const entry = selected[index];
    if (entry == null) return;
    const binary = binaryEntry(entry.request.path, entry.change, response);
    if (binary != null) {
      binaries.push(binary);
      return;
    }
    const made = diffEntry(
      entry.request.path,
      response,
      entry.change.fingerprint,
      {
        note:
          entry.request.note ??
          (entry.staged === 'all'
            ? 'Staged'
            : entry.staged === 'part'
              ? 'Partly staged'
              : undefined),
        focus: entry.request.focus,
      },
    );
    if (made != null) entries.push(made);
  });
  return { entries, binaries, changes };
}
