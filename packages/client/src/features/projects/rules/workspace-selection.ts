import {
  projectUnavailableMessage,
  type Inventory,
  type Project,
} from './inventory.ts';

export type WorkspaceReadiness = {
  readonly environmentsReady: boolean;
  readonly selectionReady: boolean;
  readonly failure:
    | { readonly source: 'storage' | 'selection'; readonly message: string }
    | undefined;
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
  readiness,
  remembered,
  paired,
  inventory,
}: {
  readiness: WorkspaceReadiness;
  remembered:
    | { readonly projectId: string; readonly worktreeId: string }
    | undefined;
  paired: boolean;
  inventory: WorkspaceInventory;
}): WorkspaceSelection {
  if (readiness.failure) return { kind: 'failed', ...readiness.failure };
  if (!readiness.environmentsReady || !readiness.selectionReady)
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
      reason: projectUnavailableMessage(project),
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
