import type { CommitSummary } from '../dtos/commit-history.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';
import { isOid } from '../../shared/oid.ts';

export const COMMIT_FORMAT = '%H%x00%P%x00%an%x00%aI%x00%D%x00%s%x00%b';
export const COMMIT_FIELDS = 7;

const STRICT_ISO_DATE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;
const SUBJECT_LIMIT = 512;
const BODY_LIMIT = 4096;

export function parseCommitRecord(fields: readonly string[]): CommitSummary {
  const [oid, parents, name, authored, decoration, subject, body] = fields;
  if (
    oid === undefined ||
    parents === undefined ||
    name === undefined ||
    authored === undefined ||
    decoration === undefined ||
    subject === undefined ||
    body === undefined ||
    !isOid(oid)
  )
    throw new UnsupportedHistoryDataError();
  if (!STRICT_ISO_DATE.test(authored)) throw new UnsupportedHistoryDataError();
  const shortenedSubject = truncateUtf8(subject, SUBJECT_LIMIT);
  const text = body.replace(/\n+$/u, '');
  const shortenedBody =
    text.trim() === '' ? undefined : truncateUtf8(text, BODY_LIMIT);
  return {
    oid,
    parentOids: parents.split(' ').filter(Boolean),
    author: { name, timestamp: authored },
    subject: shortenedSubject.value,
    subjectTruncated: shortenedSubject.truncated,
    body: shortenedBody?.value ?? null,
    bodyTruncated: shortenedBody?.truncated ?? false,
    refs: decorationRefs(decoration),
  };
}

export function parseCommitRecords(output: string): CommitSummary[] {
  const fields = output.split('\0');
  if (fields.at(-1) === '' && (fields.length - 1) % COMMIT_FIELDS === 0)
    fields.pop();
  if (fields.length % COMMIT_FIELDS !== 0)
    throw new UnsupportedHistoryDataError();
  const commits: CommitSummary[] = [];
  for (let at = 0; at < fields.length; at += COMMIT_FIELDS)
    commits.push(parseCommitRecord(fields.slice(at, at + COMMIT_FIELDS)));
  return commits;
}

function decorationRefs(decoration: string): string[] {
  return decoration
    .split(', ')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '' && entry !== 'HEAD')
    .map((entry) => {
      const name = /^HEAD -> (.+)$/u.exec(entry)?.[1] ?? entry;
      return name.startsWith('tag: ') ? name.slice('tag: '.length) : name;
    });
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
