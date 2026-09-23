import type { CommitSummary, HeadSnapshot } from '../dtos/commit-history.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';

export const COMMIT_FORMAT = '%H%x00%P%x00%an%x00%aI%x00%D%x00%s%x00%b';
export const COMMIT_FIELDS = 7;

export interface ParsedCommit {
  summary: CommitSummary;
  decoration: string;
}

export function parseCommitRecord(fields: readonly string[]): ParsedCommit {
  const [oid, parents, name, authored, decoration, subject, body] = fields;
  if (
    oid === undefined ||
    parents === undefined ||
    name === undefined ||
    authored === undefined ||
    decoration === undefined ||
    subject === undefined ||
    body === undefined
  )
    throw new UnsupportedHistoryDataError();
  const timestamp = new Date(authored);
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(oid))
    throw new UnsupportedHistoryDataError();
  if (!Number.isFinite(timestamp.getTime()))
    throw new UnsupportedHistoryDataError();
  const shortenedSubject = truncateUtf8(subject, 512);
  const text = body.replace(/\n+$/u, '');
  const shortenedBody = text.trim() === '' ? null : truncateUtf8(text, 4096);
  return {
    summary: {
      oid,
      parentOids: parents.split(' ').filter(Boolean),
      author: { name, timestamp: timestamp.toISOString() },
      subject: shortenedSubject.value,
      subjectTruncated: shortenedSubject.truncated,
      body: shortenedBody?.value ?? null,
      bodyTruncated: shortenedBody?.truncated ?? false,
      refs: decorationRefs(decoration),
    },
    decoration,
  };
}

export function parseCommitRecords(output: string): ParsedCommit[] {
  const fields = output.split('\0');
  if (fields.at(-1) === '' && (fields.length - 1) % COMMIT_FIELDS === 0)
    fields.pop();
  if (fields.length % COMMIT_FIELDS !== 0)
    throw new UnsupportedHistoryDataError();
  const commits: ParsedCommit[] = [];
  for (let at = 0; at < fields.length; at += COMMIT_FIELDS)
    commits.push(parseCommitRecord(fields.slice(at, at + COMMIT_FIELDS)));
  return commits;
}

export function headFromDecoration(
  oid: string,
  decoration: string,
): HeadSnapshot {
  for (const entry of splitDecoration(decoration)) {
    if (entry === 'HEAD') return { tipOid: oid, head: { kind: 'detached' } };
    const attached = entry.match(/^HEAD -> (.+)$/u);
    if (attached?.[1])
      return {
        tipOid: oid,
        head: { kind: 'attached', ref: `refs/heads/${attached[1]}` },
      };
  }
  throw new UnsupportedHistoryDataError();
}

const splitDecoration = (decoration: string) =>
  decoration
    .split(', ')
    .map((entry) => entry.trim())
    .filter(Boolean);

function decorationRefs(decoration: string) {
  const refs: string[] = [];
  for (const entry of splitDecoration(decoration)) {
    if (entry === 'HEAD') continue;
    const attached = entry.match(/^HEAD -> (.+)$/u);
    const name = attached?.[1] ?? entry;
    refs.push(name.startsWith('tag: ') ? name.slice(5) : name);
  }
  return refs;
}

function truncateUtf8(value: string, limit: number) {
  const bytes = Buffer.from(value);
  if (bytes.length <= limit) return { value, truncated: false };
  return {
    value: new TextDecoder('utf8', { fatal: true }).decode(
      bytes.subarray(0, utf8End(bytes, limit)),
    ),
    truncated: true,
  };
}

function utf8End(bytes: Buffer, end: number): number {
  if (end === 0 || ((bytes[end] ?? 0) & 0xc0) !== 0x80) return end;
  return utf8End(bytes, end - 1);
}
