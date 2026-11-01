import type {
  ListCommitsResponse,
  ListFileCommitsResponse,
} from '@porcelain/contracts/changes';

export function historyWindow(pages: readonly ListCommitsResponse[]) {
  const current = currentPages(pages);
  const last = current.at(-1);
  return {
    snapshot: current[0]?.snapshot ?? null,
    commits: current.flatMap((page) => page.commits),
    nextAfter: last?.nextAfter ?? null,
    boundary: last?.boundary ?? null,
    restarted: last?.restarted ?? false,
  };
}

export function fileTimelineWindow(pages: readonly ListFileCommitsResponse[]) {
  const current = currentPages(pages);
  const last = current.at(-1);
  return {
    commits: current.flatMap((page) => page.commits),
    tip: current[0]?.tip ?? null,
    nextAfter: last?.nextAfter ?? null,
    boundary: last?.boundary ?? null,
    restarted: current[0]?.restarted ?? false,
  };
}

function currentPages<Page extends { readonly restarted: boolean }>(
  pages: readonly Page[],
) {
  const restartedAt = pages.findLastIndex((page) => page.restarted);
  return restartedAt === -1 ? pages : pages.slice(restartedAt);
}
