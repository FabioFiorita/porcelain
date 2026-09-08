import type { CommitSummary, HeadSnapshot } from '../dtos/commit-history.ts';
import { HistorySnapshotUnavailableError } from '../errors/history-snapshot-unavailable-error.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';
import { executeHistoryCommand } from '../execute-history-command.ts';

const oidPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
export async function readHead(
  checkout: string,
  signal?: AbortSignal,
): Promise<HeadSnapshot> {
  const symbolic = await readOptionalRef(
    checkout,
    ['symbolic-ref', '-q', 'HEAD'],
    signal,
  );
  const ref = symbolic?.trimEnd();
  if (ref) {
    const exists = await readOptionalRef(
      checkout,
      ['show-ref', '--verify', '--quiet', ref],
      signal,
    );
    if (exists === null) return { tipOid: null, head: { kind: 'unborn', ref } };
    const oid = (
      await executeHistoryCommand(
        checkout,
        ['rev-parse', '--verify', `${ref}^{commit}`],
        signal,
      )
    ).trim();
    return { tipOid: oid, head: { kind: 'attached', ref } };
  }
  const oid = (
    await executeHistoryCommand(
      checkout,
      ['rev-parse', '--verify', 'HEAD^{commit}'],
      signal,
    )
  ).trim();
  return { tipOid: oid, head: { kind: 'detached' } };
}
export async function readCommit(
  checkout: string,
  oid: string,
  signal?: AbortSignal,
): Promise<CommitSummary> {
  if (!oidPattern.test(oid)) throw new UnsupportedHistoryDataError();
  const raw = await executeHistoryCommand(
    checkout,
    ['cat-file', 'commit', oid],
    signal,
  );
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

function absentRef(error: unknown): null {
  if (
    error instanceof HistorySnapshotUnavailableError &&
    error.cause instanceof Error &&
    error.cause.cause instanceof Error &&
    'code' in error.cause.cause &&
    error.cause.cause.code === 1
  )
    return null;
  throw error;
}

async function readOptionalRef(
  checkout: string,
  args: string[],
  signal?: AbortSignal,
) {
  try {
    return await executeHistoryCommand(checkout, args, signal);
  } catch (error) {
    return absentRef(error);
  }
}
