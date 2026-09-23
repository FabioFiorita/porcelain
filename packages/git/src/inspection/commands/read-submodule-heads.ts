import type { CheckoutSession } from '../interfaces/git-session.ts';
import { parseSubmoduleStatus } from '../parsers/parse-submodule-status.ts';
import { runInspection } from './run-inspection.ts';

export async function readSubmoduleHeads(
  session: CheckoutSession,
  paths: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths)];
  if (wanted.length === 0) return new Map();
  const output = await runInspection(
    session.path,
    ['submodule', 'status', '--', ...wanted],
    signal,
    { maxBytes: 1024 * 1024 },
  );
  return parseSubmoduleStatus(output.toString('utf8'), wanted);
}
