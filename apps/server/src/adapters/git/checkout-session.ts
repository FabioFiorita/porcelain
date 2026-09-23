import type { GitSession } from '@porcelain/git/inspection';

export type CheckoutWorktree = {
  path: string;
  administrativeDirectory: string;
  metadataIdentity: string;
  repositoryIdentity: string;
};

export type CheckoutWorktreeReader<
  T extends CheckoutWorktree = CheckoutWorktree,
> = {
  reachable(worktreeId: string, signal?: AbortSignal): Promise<T>;
};

export type EnvironmentReader = {
  read(): { environmentId: string };
};

export async function resolveCheckoutSession<T extends CheckoutWorktree>(
  worktrees: CheckoutWorktreeReader<T>,
  store: EnvironmentReader,
  session: GitSession,
  worktreeId: string,
  signal?: AbortSignal,
) {
  const worktree = await worktrees.reachable(worktreeId, signal);
  return {
    environmentId: store.read().environmentId,
    worktree,
    metadataIdentity: worktree.metadataIdentity,
    repositoryIdentity: worktree.repositoryIdentity,
    checkout: session.checkout(
      worktree.path,
      worktree.metadataIdentity,
      worktree.repositoryIdentity,
    ),
  };
}
