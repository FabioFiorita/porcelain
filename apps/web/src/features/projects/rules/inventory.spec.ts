import { describe, expect, it } from 'vitest';
import {
  firstAvailableWorktree,
  firstWaitingWorktree,
  projectPath,
  selectedWorktreeInProject,
  worktreeLabel,
  type Inventory,
  type Project,
} from './inventory.ts';

const project: Project = {
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
      id: 'linked-ready',
      path: '/repo-linked-ready',
      main: false,
      branch: undefined,
      available: true,
      status: 'reviewed',
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
};

const inventory: Inventory = {
  environmentId: 'environment',
  projects: [project],
};

describe('project inventory decisions', () => {
  it('selects a worktree with its owning project', () => {
    expect(selectedWorktreeInProject(inventory, 'linked')).toEqual({
      projectId: 'project',
      worktree: project.worktrees[2],
    });
    expect(selectedWorktreeInProject(inventory, 'missing')).toBeUndefined();
  });

  it('prefers an available linked worktree and shows the main repository path', () => {
    expect(firstAvailableWorktree(inventory)?.id).toBe('linked-ready');
    expect(firstWaitingWorktree(inventory)?.id).toBe('linked');
    expect(projectPath(project)).toBe('/repo');
  });

  it('shows branch names without the refs prefix and labels detached heads', () => {
    expect(worktreeLabel('refs/heads/topic')).toBe('topic');
    expect(worktreeLabel(null)).toBe('Detached HEAD');
  });
});
