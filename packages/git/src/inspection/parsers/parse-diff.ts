import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { GitDiffResult } from '../dtos/git-diff.ts';
import { InvalidGitDiffError } from '../../shared/errors/invalid-git-diff-error.ts';
import { parseRawDiffEffect } from './parse-raw-diff.ts';

const SECTION_HEADER = Buffer.from('diff --git ');
const LINE_SECTION_HEADER = Buffer.from('\ndiff --git ');

export function diffKey(paths: readonly (string | null)[]): string {
  return [...new Set(paths)]
    .filter((path): path is string => path !== null)
    .join('\0');
}

export const parseDiff = Effect.fn('Git.parseDiff')(function* (
  output: Buffer,
  limits: GitLimits,
) {
  const { entries, end } = yield* parseRawDiffEffect(output);
  const sections = splitSections(output.subarray(end));
  const results = new Map<string, GitDiffResult>();
  let at = 0;
  for (const entry of entries) {
    const first = sections[at];
    const second = entry.status === 'T' ? sections[at + 1] : undefined;
    if (first === undefined || (entry.status === 'T' && second === undefined))
      return yield* Effect.fail(new InvalidGitDiffError());
    const owned = second === undefined ? [first] : [first, second];
    results.set(
      diffKey([entry.oldPath, entry.newPath]),
      classify(Buffer.concat(owned), limits),
    );
    at += owned.length;
  }
  if (at !== sections.length)
    return yield* Effect.fail(new InvalidGitDiffError());
  return results;
});

function splitSections(patch: Buffer): Buffer[] {
  const starts: number[] = patch
    .subarray(0, SECTION_HEADER.length)
    .equals(SECTION_HEADER)
    ? [0]
    : [];
  for (
    let at = patch.indexOf(LINE_SECTION_HEADER);
    at !== -1;
    at = patch.indexOf(LINE_SECTION_HEADER, at + 1)
  )
    starts.push(at + 1);
  return starts.map((start, index) =>
    patch.subarray(start, starts[index + 1] ?? patch.length),
  );
}

function classify(section: Buffer, limits: GitLimits): GitDiffResult {
  if (section.byteLength > limits.inspection.patchBytes)
    return { kind: 'omitted', reason: 'size-limit' };
  let patch: string;
  try {
    patch = new TextDecoder('utf-8', { fatal: true }).decode(section);
  } catch {
    return { kind: 'omitted', reason: 'unsupported-encoding' };
  }
  if (/^Binary files .* differ$/mu.test(patch)) return { kind: 'binary' };
  return { kind: /^@@ /mu.test(patch) ? 'text' : 'metadata-only', patch };
}
