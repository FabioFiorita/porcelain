import { describe, expect, it } from 'vitest';
import {
  firstAvailableWorktree,
  projectPath,
  projectUnavailableMessage,
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
      branch: 'main',
      available: true,
    },
    {
      id: 'linked-ready',
      path: '/repo-linked-ready',
      main: false,
      branch: undefined,
      available: true,
    },
    {
      id: 'linked',
      path: '/repo-linked',
      main: false,
      branch: undefined,
      available: true,
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

  it('prefers an available linked worktree and shows the main repository path', () => {
    expect(firstAvailableWorktree(inventory)?.id).toBe('linked-ready');
    expect(projectPath(project)).toBe('/repo');
  });
  it('falls back to an available linked worktree when none needs attention', () => {
    const result = firstAvailableWorktree({
      ...inventory,
      projects: [
        {
          ...project,
          worktrees: project.worktrees.map((tree) => ({
            ...tree,
          })),
        },
      ],
    });
    expect(result?.id).toBe('linked-ready');
  });
});

describe('worktree labels', () => {
  it('shows branch names and labels detached heads', () => {
    expect(worktreeLabel('topic')).toBe('topic');
    expect(worktreeLabel(null)).toBe('Detached HEAD');
  });
});

it.each([
  [
    'moved',
    "Porcelain doesn't recognise this repository as the one it registered. Remove the project and add it again.",
  ],
  ['missing', 'The repository folder is missing.'],
  [
    'permission',
    'Porcelain cannot read this repository because access is denied.',
  ],
  ['git-failed', 'Git could not read this repository.'],
  [undefined, "Porcelain can't reach this repository right now."],
] as const)('explains %s', (unavailableReason, sentence) => {
  expect(
    projectUnavailableMessage(
      unavailableReason === undefined ? {} : { unavailableReason },
    ),
  ).toBe(sentence);
});
