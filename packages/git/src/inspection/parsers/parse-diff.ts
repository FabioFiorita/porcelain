import type { GitDiffResult } from '../dtos/git-diff.ts';
import { InvalidGitDiffError } from '../errors/invalid-git-diff-error.ts';
import { parseRawDiff } from './parse-raw-diff.ts';

const MAX_PATCH_BYTES = 1024 * 1024;
const SECTION_HEADER = Buffer.from('diff --git ');

export function diffKey(paths: readonly (string | null)[]): string {
  return [...new Set(paths)]
    .filter((path): path is string => path !== null)
    .join('\0');
}

export function parseDiff(output: Buffer): Map<string, GitDiffResult> {
  const { entries, end } = parseRawDiff(output);
  const sections = splitSections(output.subarray(end));
  const results = new Map<string, GitDiffResult>();
  let at = 0;
  for (const entry of entries) {
    const owned = entry.status === 'T' ? 2 : 1;
    if (at + owned > sections.length) throw new InvalidGitDiffError();
    results.set(
      diffKey([entry.oldPath, entry.newPath]),
      classify(Buffer.concat(sections.slice(at, at + owned))),
    );
    at += owned;
  }
  if (at !== sections.length) throw new InvalidGitDiffError();
  return results;
}

function splitSections(patch: Buffer): Buffer[] {
  const starts: number[] = [];
  for (let at = 0; at < patch.length; at += 1)
    if (
      (at === 0 || patch[at - 1] === 0x0a) &&
      patch.subarray(at, at + SECTION_HEADER.length).equals(SECTION_HEADER)
    )
      starts.push(at);
  return starts.map((start, index) =>
    patch.subarray(start, starts[index + 1] ?? patch.length),
  );
}

function classify(section: Buffer): GitDiffResult {
  if (section.byteLength > MAX_PATCH_BYTES)
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
