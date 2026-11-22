import { processFile } from '@pierre/diffs/utils/parsePatchFiles';
import type { WalkthroughJob } from '../models/walkthrough.ts';

const MAX_CAPTURED_HUNK_LENGTH = 1_048_576;

export function capturedExcerpt(job: WalkthroughJob, step: number) {
  if (job.run.state.status !== 'ready') return undefined;
  const excerpt = job.run.state.content.stops[step - 1]?.excerpts[0];
  if (!excerpt) return undefined;
  const { path, side, start, end } = excerpt;
  if (start < 1 || end < start) return undefined;
  const matches: string[] = [];
  const options = { disableLineMatching: true, throwOnError: true };
  try {
    for (const section of job.patch.split(/(?=^diff --git )/m)) {
      const [header, ...hunks] = section.split(/(?=^@@ )/m);
      if (!header || hunks.length === 0) continue;
      const identity = processFile(header, options);
      if (
        !identity ||
        (side === 'old'
          ? (identity.prevName ?? identity.name)
          : identity.name) !== path
      )
        continue;
      const file = processFile(section, options);
      file?.hunks.forEach((hunk, index) => {
        const [first, count] =
          side === 'old'
            ? [hunk.deletionStart, hunk.deletionCount]
            : [hunk.additionStart, hunk.additionCount];
        if (start >= first && end < first + count && hunks[index] !== undefined)
          matches.push(`${header}${hunks[index]}`);
      });
    }
    const [match] = matches;
    return matches.length === 1 &&
      match &&
      match.length <= MAX_CAPTURED_HUNK_LENGTH
      ? match
      : undefined;
  } catch {
    return undefined;
  }
}
