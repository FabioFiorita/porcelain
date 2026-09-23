import { parseStashList } from '../../shared/refs.ts';
import type { GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readStashLog } from './read-stash-log.ts';

const STASH_SELECTOR = /^stash@\{[0-9]+\}$/u;

export async function removeAppliedStash(
  process: GitProcessRunner,
  stashOid: string,
  inspectedLog: string,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const unknown: GitActionOutcome = {
    state: 'indeterminate',
    reason: 'OUTCOME_UNKNOWN',
    result: { stashOid, stashRetained: true },
    refreshRequired: true,
  };
  const current = await readStashLog(process, signal);
  const entries = parseStashList(current);
  const selected = entries.filter((entry) => entry.oid === stashOid);
  const [entry] = selected;
  if (
    current !== inspectedLog ||
    selected.length !== 1 ||
    entry === undefined ||
    !STASH_SELECTOR.test(entry.selector)
  )
    return unknown;
  const dropped = await process.execute(
    ['stash', 'drop', entry.selector],
    signal,
  );
  const dropFailure = processFailure(dropped);
  if (dropFailure)
    return {
      state: 'indeterminate',
      reason:
        dropFailure.reason === 'PROCESS_GROUP_UNCONFIRMED'
          ? dropFailure.reason
          : 'OUTCOME_UNKNOWN',
      result: { stashOid },
      refreshRequired: true,
    };
  const expected = entries
    .filter((candidate) => candidate !== entry)
    .map((candidate) => candidate.oid);
  const remaining = parseStashList(await readStashLog(process, signal)).map(
    (candidate) => candidate.oid,
  );
  if (
    expected.length !== remaining.length ||
    expected.some((oid, index) => oid !== remaining[index])
  )
    return {
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      result: { stashOid },
      refreshRequired: true,
    };
  return {
    state: 'succeeded',
    result: { stashOid, stashRetained: false },
    refreshRequired: true,
  };
}
