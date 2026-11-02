import type { ServerHit } from './protocol.ts';

export function statusReadWorktreeIds(hits: readonly ServerHit[]) {
  return hits
    .flatMap((hit) => {
      const match = /^\/api\/worktrees\/([^/]+)\/git\/status$/.exec(hit.path);
      return hit.method === 'GET' && match ? [match[1]] : [];
    })
    .sort();
}
