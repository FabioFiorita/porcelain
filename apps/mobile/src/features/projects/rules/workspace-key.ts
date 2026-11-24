export function workspaceKey(
  computer: { readonly environmentId: string },
  scope: { readonly projectId: string; readonly worktreeId: string },
) {
  return JSON.stringify([
    computer.environmentId,
    scope.projectId,
    scope.worktreeId,
  ]);
}
