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
  const message = raw.slice(separator + 2).replace(/\n+$/u, '');
  const messageLines = message.split('\n');
  const subjectIndex = messageLines.findIndex((line) => line.trim() !== '');
  const subject = subjectIndex === -1 ? '' : (messageLines[subjectIndex] ?? '');
  const shortenedSubject = truncateUtf8(subject, 512);
  const bodyLines =
    subjectIndex === -1 ? [] : messageLines.slice(subjectIndex + 1);
  // Git conventionally separates the subject and body with one blank line.
  // Remove that framing line while retaining all body line breaks and spacing.
  if (bodyLines[0] === '') bodyLines.shift();
  const bodyText = bodyLines.join('\n');
  const body = bodyText.trim() === '' ? null : bodyText;
  const shortenedBody = body == null ? null : truncateUtf8(body, 4096);
  const timestamp = new Date(Number(author[2]) * 1000);
  if (!Number.isFinite(timestamp.getTime()))
    throw new UnsupportedHistoryDataError();
  return {
    oid,
    parentOids: headers
      .filter((line) => line.startsWith('parent '))
      .map((line) => line.slice(7)),
    author: { name: author[1], timestamp: timestamp.toISOString() },
    subject: shortenedSubject.value,
    subjectTruncated: shortenedSubject.truncated,
    body: shortenedBody?.value ?? null,
    bodyTruncated: shortenedBody?.truncated ?? false,
    refs: [],
  };
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
