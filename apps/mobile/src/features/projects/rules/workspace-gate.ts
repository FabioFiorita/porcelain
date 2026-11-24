export type WorkspaceGateContent<W> =
  | {
      readonly kind: 'reading';
      readonly workspace: W;
      readonly notice: boolean;
    }
  | { readonly kind: 'status' };

export function workspaceGateContent<W extends { readonly key: string }>({
  state,
  shown,
  remembered,
  expected,
  nested,
  remote,
}: {
  state: { readonly kind: string; readonly workspace?: W };
  shown: W | undefined;
  remembered: string | undefined;
  expected: string | undefined;
  nested: boolean;
  remote: boolean;
}): WorkspaceGateContent<W> {
  const workspace =
    state.kind === 'selected'
      ? state.workspace
      : state.kind === 'loading' && shown?.key === remembered
        ? shown
        : undefined;
  if (!workspace || (expected !== undefined && workspace.key !== expected))
    return { kind: 'status' };
  return { kind: 'reading', workspace, notice: !nested && remote };
}
