import { runInspection } from './run-inspection.ts';

export async function readHeadCommit(
  checkout: string,
  headOid: string,
  signal?: AbortSignal,
): Promise<{ subject: string; body?: string }> {
  const output = await runInspection(
    checkout,
    ['show', '-s', '--format=%s%x00%b', headOid],
    signal,
    { maxBytes: 64 * 1024 },
  );
  const [subject = '', body = ''] = output
    .toString('utf8')
    .trimEnd()
    .split('\0');
  return { subject, ...(body ? { body } : {}) };
}
