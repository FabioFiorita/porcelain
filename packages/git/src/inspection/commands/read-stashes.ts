import { parseStashList, STASH_LIST_ARGS } from '../../shared/refs.ts';
import { runInspection } from './run-inspection.ts';

export async function readStashes(
  checkout: string,
  signal?: AbortSignal,
): Promise<{ oid: string; message: string }[]> {
  const output = await runInspection(
    checkout,
    [...STASH_LIST_ARGS, '-100'],
    signal,
    { maxBytes: 1024 * 1024 },
  );
  return parseStashList(output.toString('utf8')).map(({ oid, message }) => ({
    oid,
    message,
  }));
}
