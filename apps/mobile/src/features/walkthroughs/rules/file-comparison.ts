export function fileComparison(
  branch: readonly { readonly path: string }[] | undefined,
  path: string,
): { kind: 'branch' } | { kind: 'worktree' } | undefined {
  if (branch === undefined) return undefined;
  return branch.some((file) => file.path === path)
    ? { kind: 'branch' }
    : { kind: 'worktree' };
}
