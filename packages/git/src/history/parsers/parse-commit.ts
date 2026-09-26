import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { CommitSummary } from '../dtos/commit-history.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';
import { isOid } from '../../shared/parsers/oid.ts';

export const COMMIT_FORMAT = '%H%x00%P%x00%an%x00%aI%x00%D%x00%s%x00%b';
export const COMMIT_FIELDS = COMMIT_FORMAT.split('%x00').length;

const STRICT_ISO_DATE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

export function parseCommitRecord(
  fields: readonly string[],
  limits: GitLimits,
): CommitSummary {
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
  const shortenedSubject = truncateUtf8(subject, limits.history.subjectBytes);
  const text = body.replace(/\n+$/u, '');
  const shortenedBody =
    text.trim() === ''
      ? undefined
      : truncateUtf8(text, limits.history.bodyBytes);
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

export function parseCommitRecords(
  output: string,
  limits: GitLimits,
): CommitSummary[] {
  const fields = output.split('\0');
  if (fields.at(-1) === '' && (fields.length - 1) % COMMIT_FIELDS === 0)
    fields.pop();
  if (fields.length % COMMIT_FIELDS !== 0)
    throw new UnsupportedHistoryDataError();
  const commits: CommitSummary[] = [];
  for (let at = 0; at < fields.length; at += COMMIT_FIELDS)
    commits.push(
      parseCommitRecord(fields.slice(at, at + COMMIT_FIELDS), limits),
    );
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
  if (Buffer.byteLength(value) <= limit) return { value, truncated: false };
  let bytes = 0;
  let kept = '';
  for (const character of value) {
    bytes += Buffer.byteLength(character);
    if (bytes > limit) break;
    kept += character;
  }
  return { value: kept, truncated: true };
}
