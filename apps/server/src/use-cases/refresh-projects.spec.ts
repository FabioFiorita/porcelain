import { expect, it } from 'vitest';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { RefreshProjects } from './refresh-projects.ts';

function inventory() {
  const projects = ['slow', 'quick'].map((id) => ({
    id,
    name: id,
    commonDirectory: `/${id}`,
    repositoryIdentity: id,
    available: true,
    worktrees: [
      {
        id: `${id}-worktree`,
        path: `/${id}`,
        metadataIdentity: id,
        available: true,
        main: true,
        branch: 'main',
      },
    ],
  }));
  const saved: { id: string; available: boolean }[] = [];
  const store = {
    read: () => ({ environmentId: 'environment', projects }),
    save: (project: { id: string; available: boolean }) =>
      saved.push({ id: project.id, available: project.available }),
  } as unknown as InventoryStore;
  return { store, saved };
}

it('gives each repository its own budget, so one hung mount does not stop the rest', async () => {
  const { store, saved } = inventory();
  const visited: string[] = [];
  const operation = new RefreshProjects(
    store,
    (checkout: string) => ({
      listWorktrees: async (signal?: AbortSignal) => {
        visited.push(checkout);
        if (checkout === '/slow')
          // Never answers: only its own budget may stop it.
          return new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(signal.reason), {
              once: true,
            });
          });
        return {
          repository: {
            repositoryIdentity: 'quick',
            commonDirectory: '/quick',
            worktrees: [],
          },
          issues: [],
        } as never;
      },
    }),
    30,
  );
  const { inventory: result } = await operation.execute();
  // The hung repository is reported unavailable and the next one is still read.
  expect(visited).toEqual(['/slow', '/quick']);
  expect(saved.find((entry) => entry.id === 'slow')?.available).toBe(false);
  expect(result.projects).toHaveLength(2);
});
