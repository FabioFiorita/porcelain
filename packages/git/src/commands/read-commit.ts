import type { CommitSummary, HeadSnapshot } from '../dtos/commit-history.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';
import { executeHistoryCommand } from '../execute-history-command.ts';
import { readOptionalHistoryRef } from '../helpers/read-optional-history-ref.ts';
import { parseCommit } from '../mappers/parse-commit.ts';

const oidPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
export async function readHead(
  checkout: string,
  signal?: AbortSignal,
): Promise<HeadSnapshot> {
  const symbolic = await readOptionalHistoryRef(
    checkout,
    ['symbolic-ref', '-q', 'HEAD'],
    signal,
  );
  const ref = symbolic?.trimEnd();
  if (ref) {
    const exists = await readOptionalHistoryRef(
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
  return parseCommit(oid, raw);
}
