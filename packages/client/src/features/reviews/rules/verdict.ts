import type { ReadReviewResponse } from '@porcelain/contracts/reviews';
import { orderedChecks } from './proof.ts';

export type ReviewRevision = NonNullable<ReadReviewResponse['revision']>;

export function verdictSections(revision: ReviewRevision) {
  const { verdict, content } = revision;
  const deletedPaths = revision.files
    .filter((file) => file.status === 'deleted')
    .map((file) => file.path);
  const explained = new Set(verdict.removed.flatMap((entry) => entry.paths));
  return {
    header: {
      branch: revision.branch,
      base: revision.base,
      headOid: revision.headOid,
      shortHead: revision.headOid.slice(0, 7),
      revision: revision.revision,
    },
    asked: { text: verdict.asked.text, links: verdict.asked.links ?? [] },
    recommendation: {
      value: verdict.recommendation,
      label: verdict.recommendation === 'merge' ? 'Merge' : 'Hold',
      reasons: verdict.reasons,
    },
    proven: {
      headOid: revision.headOid,
      shortHead: revision.headOid.slice(0, 7),
      checks: orderedChecks(content.proof.checks),
      assets: content.proof.assets,
    },
    notProven: verdict.notProven,
    removed: {
      fileCount: deletedPaths.length,
      groups: verdict.removed.map((entry) => ({
        behavior: entry.behavior,
        why: entry.why,
        paths: deletedPaths.filter((path) => entry.paths.includes(path)),
      })),
      unexplainedPaths: deletedPaths.filter((path) => !explained.has(path)),
    },
    startHere: content.layers[0]
      ? { layerId: content.layers[0].id, title: content.layers[0].title }
      : undefined,
  };
}
