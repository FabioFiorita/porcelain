import type {
  InventoryResponse,
  ProjectResponse,
  Worktree,
} from '../contracts/inventory';

export type Inventory = InventoryResponse;
export type Project = ProjectResponse;
export type { Worktree };

/** `refs/heads/main` → `main`; a detached checkout has no branch name. */
export function worktreeLabel(branch: string | null): string {
  if (branch == null) return 'Detached HEAD';
  return branch.replace(/^refs\/heads\//, '');
}

export function selectedWorktreeInProject(
  inventory: Inventory,
  worktreeId: string | undefined,
): { worktree: Worktree; project: Project } | null {
  if (worktreeId == null) return null;
  for (const project of inventory.projects) {
    const worktree = project.worktrees.find((entry) => entry.id === worktreeId);
    if (worktree != null) return { worktree, project };
  }
  return null;
}

/** Where the project was registered: its main worktree, known even when it cannot be reached. */
export function projectPath(project: Project): string {
  return project.path;
}

/** The worktree to land on when nothing is selected: the first one with a review to read. */
export function firstWaitingWorktree(inventory: Inventory): Worktree | null {
  const all = inventory.projects.flatMap((project) => project.worktrees);
  return (
    all.find((worktree) => worktree.signal.agentReplied) ??
    all.find((worktree) => worktree.signal.review === 'ready') ??
    all[0] ??
    null
  );
}

/**
 * The sidebar dot: yellow wins (the agent replied and you have not seen it), then
 * green (a review is ready), hollow green (every layer reviewed, not committed yet).
 * No counts.
 */
export type WorktreeDot = {
  kind: 'agent-replied' | 'review-ready' | 'reviewed';
  tooltip: string;
};

export function worktreeDot(worktree: Worktree): WorktreeDot | null {
  if (worktree.signal.agentReplied)
    return { kind: 'agent-replied', tooltip: 'The agent replied' };
  if (worktree.signal.review === 'ready')
    return { kind: 'review-ready', tooltip: 'Review is ready' };
  if (worktree.signal.review === 'reviewed')
    return { kind: 'reviewed', tooltip: 'Reviewed, ready to commit' };
  return null;
}
