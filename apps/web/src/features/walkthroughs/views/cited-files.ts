import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { fileOpening } from '@porcelain/client/walkthroughs/rules';
import { changeId, branchRange } from '@porcelain/client/changes/rules';
import { commitPaths } from '@porcelain/client/history/rules';
import {
  useBranchChanges,
  useBranchDiffs,
  useChanges,
} from '@/features/changes/index';
import type { DocumentProps } from '@/features/workspace/index';

type Opening = NonNullable<ReturnType<typeof fileOpening>>;

export type FileSize = { additions: number; deletions: number };

function patchSize(patch: string): FileSize | undefined {
  let additions = 0;
  let deletions = 0;
  let inHunk = false;
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) inHunk = true;
    else if (!inHunk) continue;
    else if (line.startsWith('+')) additions += 1;
    else if (line.startsWith('-')) deletions += 1;
  }
  return additions + deletions === 0 ? undefined : { additions, deletions };
}

function openCitedFile(
  document: DocumentProps,
  path: string,
  opening: Opening,
) {
  if (opening.kind === 'file') document.onOpen({ kind: 'file', path });
  else if (opening.kind === 'branch')
    document.onOpen({ kind: 'branch-file', path });
  else
    document.onOpen(
      { kind: 'change', path },
      opening.change ? { path, entry: changeId(opening.change) } : undefined,
    );
}

export function useCitedFiles(
  document: DocumentProps,
  paths: readonly string[],
) {
  const branchResult = useBranchChanges(
    document.scope,
    document.context.connection,
    document.base,
  ).result;
  const worktree = useChanges(document.scope, document.context.connection);
  const branch = Option.getOrUndefined(AsyncResult.value(branchResult));
  const read = {
    branch: branch?.files,
    branchFailed: AsyncResult.isFailure(branchResult),
    worktree: worktree.changes,
  };
  const wanted = document.interaction.hidden === true ? [] : paths;
  const branchFiles = (branch?.files ?? []).filter((file) =>
    wanted.includes(file.path),
  );
  const diffs = useBranchDiffs(
    document.scope,
    document.context.connection,
    branch ? branchRange(branch) : null,
    branchFiles.map(commitPaths),
  );
  const size = (path: string): FileSize | undefined => {
    const file = branchFiles.find((candidate) => candidate.path === path);
    if (!file) return undefined;
    const content = diffs.patches.get(commitPaths(file).join('\0'));
    return content?.kind === 'text' ? patchSize(content.patch) : undefined;
  };
  return {
    opening: (path: string) => fileOpening(read, path),
    size,
    uncommitted: (path: string) =>
      worktree.changes.some((change) => change.path === path),
    open: (path: string) => {
      const opening = fileOpening(read, path);
      if (opening) openCitedFile(document, path, opening);
    },
  };
}
