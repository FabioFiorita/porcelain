import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import type { ResolvedWorktree } from '../../models/worktree.ts';
import { deriveWorktreeId } from '../../models/worktree-id.ts';
import { WorktreeNotFoundError } from '../errors/worktree-not-found-error.ts';
import type { ResolveWorktree } from '../resolve-worktree.ts';

export type FakeWorktree = Partial<ResolvedWorktree> & { path: string };

/**
 * A resolver over a fixed list, for tests that are about something other than
 * resolution. It answers exactly as the real one does — including refusing an
 * unreachable worktree with the error the routes map to 422 — so a spec cannot
 * pass against a resolver that is more permissive than production.
 */
export function fakeWorktrees(
  worktrees: FakeWorktree[] | (() => FakeWorktree[]),
  options: { projectAvailable?: boolean | (() => boolean) } = {},
): ResolveWorktree {
  // A function lets a test change what Git lists between two calls, which is
  // how a checkout swapped mid-request is expressed.
  const current = () =>
    (typeof worktrees === 'function' ? worktrees() : worktrees).map(
      (worktree, index) => resolve(worktree, index),
    );
  const resolve = (worktree: FakeWorktree, index: number) => {
    const projectId = worktree.projectId ?? 'project';
    const metadataIdentity = worktree.metadataIdentity ?? `identity-${index}`;
    return {
      id: worktree.id ?? deriveWorktreeId(projectId, metadataIdentity),
      projectId,
      path: worktree.path,
      branch: worktree.branch ?? null,
      main: worktree.main ?? index === 0,
      available: worktree.available ?? true,
      metadataIdentity,
      administrativeDirectory:
        worktree.administrativeDirectory ?? `${worktree.path}/.git`,
      commonDirectory: worktree.commonDirectory ?? '/fixture/.git',
      repositoryIdentity: worktree.repositoryIdentity ?? 'repository',
    } satisfies ResolvedWorktree;
  };
  const find = (id: string) => {
    const found = current().find((worktree) => worktree.id === id);
    if (!found) throw new WorktreeNotFoundError();
    return found;
  };
  const reachable = (id: string) => {
    const found = find(id);
    const projectAvailable =
      typeof options.projectAvailable === 'function'
        ? options.projectAvailable()
        : options.projectAvailable;
    if (projectAvailable === false || !found.available)
      throw new RepositoryIdentityMismatchError();
    return found;
  };
  return {
    worktrees: current(),
    known: async (id: string) => find(id),
    reachable: async (id: string) => reachable(id),
    forWriting: async (id: string) => find(id),
    inProject: async (projectId: string, id: string) => {
      const found = reachable(id);
      if (found.projectId !== projectId) throw new WorktreeNotFoundError();
      return found;
    },
  } as unknown as ResolveWorktree & { worktrees: ResolvedWorktree[] };
}
