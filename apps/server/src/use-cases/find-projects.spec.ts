import { expect, it, vi } from 'vitest';
import type { ProjectFolders } from '../filesystem/interfaces/project-folders.ts';
import { FindProjects } from './find-projects.ts';

const inventory = {
  read: () => ({ environmentId: 'fixture', projects: [] }),
  save: vi.fn(),
};

it('bounds breadth and depth when discovering repositories', async () => {
  const read = vi.fn<ProjectFolders['read']>(async (path) => ({
    path,
    parent: '/',
    gitMarker: false,
    truncated: false,
    directories: Array.from({ length: 20 }, (_, index) => ({
      name: `child-${index}`,
      path: `${path}/child-${index}`,
      symbolicLink: false,
    })),
  }));
  const git = vi.fn();
  const finder = new FindProjects({ read }, git, inventory, '/fixture');
  const result = await finder.discover();
  expect(result).toEqual({ repositories: [], limited: true });
  expect(read.mock.calls.length).toBeLessThanOrEqual(500);
  expect(read.mock.calls.every(([path]) => path.split('/').length <= 5)).toBe(
    true,
  );
  expect(git).not.toHaveBeenCalled();
});

it('stops scanning on cancellation instead of returning incomplete success', async () => {
  const controller = new AbortController();
  const read = vi.fn<ProjectFolders['read']>(async (path) => {
    controller.abort(new Error('Cancelled'));
    return {
      path,
      parent: '/',
      gitMarker: true,
      truncated: false,
      directories: [],
    };
  });
  const git = () => ({
    listWorktrees: async (signal?: AbortSignal) => {
      signal?.throwIfAborted();
      throw new Error('Should not reach Git');
    },
  });
  const finder = new FindProjects({ read }, git, inventory, '/fixture');
  await expect(finder.discover(controller.signal)).rejects.toBe(
    controller.signal.reason,
  );
  expect(read).toHaveBeenCalledTimes(1);
});
