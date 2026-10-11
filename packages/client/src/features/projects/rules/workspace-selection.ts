import type { Inventory, Project } from './inventory.ts';

export type WorkspaceReadState = {
  readonly status: 'loading' | 'ready' | 'unreadable';
  readonly error: string | undefined;
};

export type WorkspaceInventory =
  | { readonly status: 'reading' }
  | { readonly status: 'failed'; readonly message: string }
  | { readonly status: 'ready'; readonly inventory: Inventory };

export type WorkspaceSelection =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'none' }
  | {
      readonly kind: 'selected';
      readonly project: Project;
      readonly worktree: Project['worktrees'][number];
    };

export function workspaceSelection({
  storage,
  selection,
  remembered,
  environment,
  inventory,
}: {
  storage: WorkspaceReadState;
  selection: WorkspaceReadState;
  remembered:
    | { readonly projectId: string; readonly worktreeId: string }
    | undefined;
  environment: { readonly name: string } | undefined;
  inventory: WorkspaceInventory;
}): WorkspaceSelection {
  if (storage.status === 'unreadable')
    return {
      kind: 'failed',
      message: storage.error ?? 'Saved environments could not be read.',
    };
  if (selection.status === 'unreadable')
    return {
      kind: 'failed',
      message:
        selection.error ?? 'Saved workspace selections could not be read.',
    };
  if (storage.status !== 'ready' || selection.status !== 'ready')
    return { kind: 'loading' };
  if (!remembered) return { kind: 'none' };
  if (!environment)
    return {
      kind: 'unavailable',
      reason: 'This environment is no longer paired.',
    };
  if (inventory.status === 'failed')
    return { kind: 'failed', message: inventory.message };
  if (inventory.status === 'reading') return { kind: 'loading' };
  const project = inventory.inventory.projects.find(
    (entry) => entry.id === remembered.projectId,
  );
  const name = inventory.inventory.environment.name;
  if (!project)
    return {
      kind: 'unavailable',
      reason: `This project is no longer registered on ${name}.`,
    };
  if (!project.available)
    return {
      kind: 'unavailable',
      reason: `This project is unavailable on ${name}.`,
    };
  const worktree = project.worktrees.find(
    (entry) => entry.id === remembered.worktreeId,
  );
  if (!worktree)
    return {
      kind: 'unavailable',
      reason: 'This worktree is no longer in the project.',
    };
  if (!worktree.available)
    return {
      kind: 'unavailable',
      reason: `This worktree is unavailable on ${name}.`,
    };
  return { kind: 'selected', project, worktree };
}
