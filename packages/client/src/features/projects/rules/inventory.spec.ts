import { describe, expect, it } from 'vitest';
import {
  firstWaitingWorktree,
  projectPath,
  selectedWorktreeInProject,
  worktreeLabel,
} from './inventory.ts';
import type { Inventory, Project } from './inventory.ts';

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
  environment: { name: 'host', custom: false },
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

  it('prefers a waiting worktree and shows the main repository path', () => {
    expect(firstWaitingWorktree(inventory)?.id).toBe('linked');
    expect(projectPath(project)).toBe('/repo');
  });
  it('falls back to an available linked worktree when none needs attention', () => {
    const result = firstWaitingWorktree({
      ...inventory,
      projects: [
        {
          ...project,
          worktrees: project.worktrees.map((tree) => ({
            ...tree,
            status: undefined,
          })),
        },
      ],
    });
    expect(result?.id).toBe('linked-ready');
  });
});

describe('worktree labels', () => {
  it('shows branch names without the refs prefix and labels detached heads', () => {
    expect(worktreeLabel('refs/heads/topic')).toBe('topic');
    expect(worktreeLabel(null)).toBe('Detached HEAD');
  });
});
