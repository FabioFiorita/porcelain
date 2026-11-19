import type { WorkspaceSelection } from '@porcelain/client/projects/rules';

export function pickerError(
  workspace:
    | Exclude<WorkspaceSelection, { kind: 'selected' }>
    | { readonly kind: 'selected' },
  command: string | undefined,
) {
  if (workspace.kind === 'failed' && workspace.source !== 'inventory')
    return workspace.message;
  return command;
}
