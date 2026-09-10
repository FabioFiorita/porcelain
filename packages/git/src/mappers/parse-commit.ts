import type { CommitSummary } from '../dtos/commit-history.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';

export function parseCommit(oid: string, raw: string): CommitSummary {
  const separator = raw.indexOf('\n\n');
  const headers = raw.slice(0, separator).split('\n');
  const author = headers
    .find((line) => line.startsWith('author '))
    ?.match(/^author (.*) <.*> (-?\d+) [+-]\d{4}$/);
  if (separator < 0 || !author?.[1] || !author[2])
    throw new UnsupportedHistoryDataError();
  const subject =
    raw
      .slice(separator + 2)
      .split('\n')
      .find((line) => line.trim() !== '') ?? '';
  const bytes = Buffer.from(subject);
  const shortened =
    bytes.length > 512
      ? new TextDecoder('utf8', { fatal: true }).decode(
          bytes.subarray(0, utf8End(bytes, 512)),
        )
      : subject;
  const timestamp = new Date(Number(author[2]) * 1000);
  if (!Number.isFinite(timestamp.getTime()))
    throw new UnsupportedHistoryDataError();
  return {
    oid,
    parentOids: headers
      .filter((line) => line.startsWith('parent '))
      .map((line) => line.slice(7)),
    author: { name: author[1], timestamp: timestamp.toISOString() },
    subject: shortened,
    subjectTruncated: bytes.length > 512,
  };
}
function utf8End(bytes: Buffer, end: number): number {
  if (end === 0 || ((bytes[end] ?? 0) & 0xc0) !== 0x80) return end;
  return utf8End(bytes, end - 1);
}
