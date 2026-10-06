import type { ListCommitsResponse } from '@porcelain/contracts/changes';

export function historyWindow(pages: readonly ListCommitsResponse[]) {
  const restartedAt = pages.findLastIndex((page) => page.restarted);
  const current = restartedAt === -1 ? pages : pages.slice(restartedAt);
  const last = current.at(-1);
  return {
    snapshot: current[0]?.snapshot ?? null,
    commits: current.flatMap((page) => page.commits),
    nextAfter: last?.nextAfter ?? null,
    boundary: last?.boundary ?? null,
    restarted: last?.restarted ?? false,
  };
}
