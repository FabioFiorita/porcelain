import {
  projectUnavailableMessage,
  type Inventory,
  type Project,
} from './inventory.ts';

export type SavedRead = {
  readonly status: 'loading' | 'ready' | 'unreadable';
  readonly error: string | undefined;
};

export type WorkspaceInventory =
  | { readonly status: 'reading' }
  | { readonly status: 'failed'; readonly message: string }
  | { readonly status: 'ready'; readonly inventory: Inventory };

export type WorkspaceSelection =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'failed';
      readonly source: 'storage' | 'selection' | 'inventory';
      readonly message: string;
    }
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
  paired,
  inventory,
}: {
  storage: SavedRead;
  selection: SavedRead;
  remembered:
    | { readonly projectId: string; readonly worktreeId: string }
    | undefined;
  paired: boolean;
  inventory: WorkspaceInventory;
}): WorkspaceSelection {
  if (storage.status === 'unreadable')
    return {
      kind: 'failed',
      source: 'storage',
      message: storage.error ?? 'Saved environments could not be read.',
    };
  if (selection.status === 'unreadable')
    return {
      kind: 'failed',
      source: 'selection',
      message:
        selection.error ?? 'Saved workspace selections could not be read.',
    };
  if (storage.status !== 'ready' || selection.status !== 'ready')
    return { kind: 'loading' };
  if (!remembered) return { kind: 'none' };
  if (!paired)
    return {
      kind: 'unavailable',
      reason: 'This environment is no longer paired.',
    };
  if (inventory.status === 'failed')
    return { kind: 'failed', source: 'inventory', message: inventory.message };
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
      reason:
        project.unavailableReason === undefined
          ? `This project is unavailable on ${name}.`
          : projectUnavailableMessage(project),
    };
  const worktree = project.worktrees.find(
    (entry) => entry.id === remembered.worktreeId,
  );
  if (!worktree)
    return {
      kind: 'unavailable',
      reason: `This worktree is no longer in the project on ${name}.`,
    };
  if (!worktree.available)
    return {
      kind: 'unavailable',
      reason: `This worktree is unavailable on ${name}.`,
    };
  return { kind: 'selected', project, worktree };
}
