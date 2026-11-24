import type {
  WalkthroughBlock,
  WalkthroughBlockRequest,
} from '../models/blocks.ts';
import type {
  WalkthroughContent,
  WalkthroughDraft,
  WalkthroughEvidence,
  WalkthroughJob,
} from '../models/walkthrough.ts';
import { capturedDiffHunk } from './captured-excerpt.ts';

const LEFTOVER_TITLE = 'Everything else';

function withUniqueTitles<Stop extends { readonly title: string }>(
  stops: readonly Stop[],
): Stop[] {
  const taken = new Set(stops.map((stop) => stop.title));
  const seen = new Set<string>();
  return stops.map((stop) => {
    if (!seen.has(stop.title)) {
      seen.add(stop.title);
      return stop;
    }
    let number = 2;
    while (taken.has(`${stop.title} (${number})`)) number += 1;
    const title = `${stop.title} (${number})`;
    taken.add(title);
    return { ...stop, title };
  });
}

function qualifyBlock(
  block: WalkthroughBlockRequest,
  job: WalkthroughJob,
  evidence: WalkthroughEvidence,
  covered: ReadonlySet<string>,
  excerpted: ReadonlySet<string>,
): { block: WalkthroughBlock; paths: readonly string[] } | undefined {
  switch (block.kind) {
    case 'diff_excerpt': {
      const file = job.files.find(
        (item) =>
          (block.side === 'old' ? (item.oldPath ?? item.path) : item.path) ===
          block.path,
      );
      if (
        file === undefined ||
        excerpted.has(file.path) ||
        !capturedDiffHunk(job.patch, block)
      )
        return undefined;
      return {
        block: {
          ...block,
          headOid: job.run.headOid,
          contentTreeOid: job.run.contentTreeOid,
        },
        paths: [file.path],
      };
    }
    case 'before_after':
      if (
        evidence.unavailable !== undefined ||
        block.before.assetId === block.after.assetId ||
        ![block.before, block.after].every((image) =>
          evidence.assets.some((asset) => asset.id === image.assetId),
        )
      )
        return undefined;
      return { block, paths: [] };
    case 'files': {
      const [first, ...rest] = block.files.filter(
        ({ path }) =>
          !covered.has(path) && job.files.some((file) => file.path === path),
      );
      if (first === undefined) return undefined;
      return {
        block: { ...block, files: [first, ...rest] },
        paths: [first.path, ...rest.map((file) => file.path)],
      };
    }
    case 'checks':
      if (
        block.headOid !== job.run.headOid ||
        evidence.unavailable !== undefined ||
        evidence.checks === undefined
      )
        return undefined;
      return { block: { ...block, ...evidence.checks }, paths: [] };
    case 'callout': {
      const { attention, comparison } = block;
      if (
        !attention.question.trim() ||
        !attention.note.trim() ||
        (comparison !== undefined &&
          (comparison.columns.length !== 2 ||
            comparison.rows.length === 0 ||
            comparison.rows.length > 6 ||
            comparison.rows.some((row) => row.length !== 2)))
      )
        return undefined;
      return { block, paths: [] };
    }
  }
}

export function qualifyWalkthrough(
  content: WalkthroughDraft,
  job: WalkthroughJob,
  evidence: WalkthroughEvidence,
): WalkthroughContent {
  if (content.outcome === 'nothing')
    return { ...content, stops: [], stillUnclear: [] };
  const covered = new Set<string>();
  const excerpted = new Set<string>();
  const stops = content.stops.map((stop) => {
    const qualified = stop.blocks.flatMap((block) => {
      const match = qualifyBlock(block, job, evidence, covered, excerpted);
      return match === undefined ? [] : [match];
    });
    for (const item of qualified) {
      for (const path of item.paths) {
        covered.add(path);
        if (item.block.kind === 'diff_excerpt') excerpted.add(path);
      }
    }
    return { ...stop, blocks: qualified.map((item) => item.block) };
  });
  const [first, ...rest] = job.files
    .filter((file) => !covered.has(file.path))
    .map((file) => ({ path: file.path, note: 'Supporting change' }));
  if (first !== undefined) {
    const block: WalkthroughBlock = { kind: 'files', files: [first, ...rest] };
    const leftover = stops.find((stop) => stop.title === LEFTOVER_TITLE);
    if (leftover) leftover.blocks.push(block);
    else
      stops.push({
        title: LEFTOVER_TITLE,
        explanation: 'These changed files complete the change.',
        blocks: [block],
      });
  }
  return {
    ...content,
    outcome:
      content.outcome === 'needs_you' &&
      !stops.some((stop) =>
        stop.blocks.some((block) => block.kind === 'callout'),
      )
        ? 'worth_knowing'
        : content.outcome,
    stops: withUniqueTitles(stops),
    stillUnclear: content.stillUnclear.slice(0, 8),
  };
}
