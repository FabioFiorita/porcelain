type BranchFile = { readonly path: string; readonly status?: string };
type LocalFile = {
  readonly path: string;
  readonly comparisons?: readonly object[];
};

type ChangedFiles = {
  readonly branch: readonly BranchFile[] | undefined;
  readonly branchFailed: boolean;
  readonly worktree: readonly LocalFile[];
};

type Comparison = { kind: 'branch' } | { kind: 'worktree' };

const deletedLocally = (file: LocalFile | undefined) =>
  (file?.comparisons ?? []).some(
    (comparison) => 'kind' in comparison && comparison.kind === 'deleted',
  );

export function fileComparison(
  read: ChangedFiles,
  path: string,
): Comparison | undefined {
  const local = read.worktree.find((file) => file.path === path);
  if (deletedLocally(local)) return { kind: 'worktree' };
  if (read.branch === undefined)
    return read.branchFailed && local ? { kind: 'worktree' } : undefined;
  return read.branch.some((file) => file.path === path)
    ? { kind: 'branch' }
    : { kind: 'worktree' };
}

export function fileOpening(
  read: ChangedFiles,
  path: string,
): Comparison | { kind: 'file' } | undefined {
  if (deletedLocally(read.worktree.find((file) => file.path === path)))
    return { kind: 'worktree' };
  if (read.branch === undefined)
    return read.branchFailed ? { kind: 'file' } : undefined;
  return read.branch.find((file) => file.path === path)?.status === 'deleted'
    ? { kind: 'branch' }
    : { kind: 'file' };
}
