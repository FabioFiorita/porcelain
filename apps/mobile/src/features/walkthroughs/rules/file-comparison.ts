type Listed = readonly { readonly path: string }[];

export function fileComparison(
  read: {
    readonly branch: Listed | undefined;
    readonly branchFailed: boolean;
    readonly worktree: Listed;
  },
  path: string,
): { kind: 'branch' } | { kind: 'worktree' } | undefined {
  const local = read.worktree.some((file) => file.path === path);
  if (read.branch === undefined)
    return read.branchFailed && local ? { kind: 'worktree' } : undefined;
  return read.branch.some((file) => file.path === path)
    ? { kind: 'branch' }
    : { kind: 'worktree' };
}
