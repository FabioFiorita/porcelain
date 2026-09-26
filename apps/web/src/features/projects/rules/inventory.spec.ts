import { describe, expect, it } from 'vitest';
import {
  firstAvailableWorktree,
  firstWaitingWorktree,
  projectPath,
  selectedWorktreeInProject,
  worktreeLabel,
  type Inventory,
} from './inventory.ts';

const inventory: Inventory = {
  environmentId: 'environment',
  projects: [
    {
      id: 'project',
      name: 'Example',
      available: true,
      worktrees: [
        {
          id: 'main',
          path: '/repo',
          main: true,
          branch: 'refs/heads/main',
          available: true,
          status: undefined,
        },
        {
          id: 'linked',
          path: '/repo-linked',
          main: false,
          branch: undefined,
          available: true,
          status: 'pending',
        },
      ],
    },
  ],
};

describe('project inventory decisions', () => {
  it('selects a worktree with its owning project', () => {
    expect(selectedWorktreeInProject(inventory, 'linked')).toEqual({
      projectId: 'project',
      worktree: inventory.projects[0]?.worktrees[1],
    });
    expect(selectedWorktreeInProject(inventory, 'missing')).toBeUndefined();
  });

  it('prefers an available linked worktree and shows the main repository path', () => {
    expect(firstAvailableWorktree(inventory)?.id).toBe('linked');
    expect(firstWaitingWorktree(inventory)?.id).toBe('linked');
    expect(projectPath(inventory.projects[0]!)).toBe('/repo');
  });

  it('shows branch names without the refs prefix and labels detached heads', () => {
    expect(worktreeLabel('refs/heads/topic')).toBe('topic');
    expect(worktreeLabel(null)).toBe('Detached HEAD');
  });
});
