import fc from 'fast-check';
import { expect, it } from 'vitest';
import type { DiscoveredRepository } from '../../git/dtos/discovered-repository.ts';
import { reconcileProject } from './reconcile-project.ts';

const identities = fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 20 });

function discovery(metadata: string[]): DiscoveredRepository {
  return {
    commonDirectory: '/projects/example/.git',
    repositoryIdentity: 'repository',
    worktrees: metadata.map((metadataIdentity, index) => ({
      metadataIdentity,
      path: `/checkouts/${index}`,
      branch: 'refs/heads/main',
      main: index === 0,
      available: true,
    })),
  };
}

it('preserves worktree identity through moves, branch changes, and discovery reorder', () => {
  fc.assert(
    fc.property(
      identities.chain((metadata) =>
        fc.tuple(
          fc.constant(metadata),
          fc.shuffledSubarray(metadata, {
            minLength: metadata.length,
            maxLength: metadata.length,
          }),
          fc.option(fc.string(), { nil: null }),
        ),
      ),
      ([metadata, reordered, branch]) => {
        const previous = reconcileProject(discovery(metadata));
        const moved = discovery(reordered);
        moved.commonDirectory = '/moved/example/.git';
        moved.worktrees = moved.worktrees.map((worktree, index) => ({
          ...worktree,
          path: `/moved/checkouts/${index}`,
          branch,
        }));

        const refreshed = reconcileProject(moved, previous);

        expect(refreshed.id).toBe(previous.id);
        expect(refreshed.worktrees).toHaveLength(previous.worktrees.length);
        for (const known of previous.worktrees) {
          expect(
            refreshed.worktrees.find((worktree) => worktree.id === known.id),
          ).toMatchObject({ metadataIdentity: known.metadataIdentity });
        }
      },
    ),
  );
});

it('assigns distinct fresh IDs when new metadata replaces checkouts at the same paths', () => {
  fc.assert(
    fc.property(identities, (metadata) => {
      const previous = reconcileProject(discovery(metadata));
      const replacements = discovery(
        metadata.map((identity) => `new:${identity}`),
      );

      const refreshed = reconcileProject(replacements, previous);
      const allIds = [...previous.worktrees, ...refreshed.worktrees].map(
        (worktree) => worktree.id,
      );

      expect(refreshed.worktrees).toHaveLength(metadata.length);
      expect(new Set(allIds).size).toBe(metadata.length * 2);
    }),
  );
});

it('retains unavailable worktree identity so a later move can reconnect it', () => {
  fc.assert(
    fc.property(identities, (metadata) => {
      const original = discovery(metadata);
      const previous = reconcileProject(original);
      const unavailable = {
        ...original,
        worktrees: original.worktrees.map((worktree) => ({
          ...worktree,
          metadataIdentity: null,
          available: false,
        })),
      };

      const offline = reconcileProject(unavailable, previous);
      expect(offline.worktrees).toEqual(
        previous.worktrees.map((worktree) => ({
          ...worktree,
          available: false,
        })),
      );

      const moved = {
        ...original,
        worktrees: original.worktrees.map((worktree) => ({
          ...worktree,
          path: `/moved${worktree.path}`,
        })),
      };
      const recovered = reconcileProject(moved, offline);
      expect(recovered.worktrees.map((worktree) => worktree.id)).toEqual(
        previous.worktrees.map((worktree) => worktree.id),
      );
      expect(recovered.worktrees.every((worktree) => worktree.available)).toBe(
        true,
      );
    }),
  );
});
