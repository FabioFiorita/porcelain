import type { CheckoutSession } from '../interfaces/git-session.ts';
import { runInspection } from '../read-inspection.ts';

export async function readSubmoduleHeads(
  session: CheckoutSession,
  paths: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths)];
  const heads = new Map<string, string>();
  if (wanted.length === 0) return heads;
  const output = await runInspection(
    session.path,
    ['submodule', 'status', '--', ...wanted],
    signal,
    { maxBytes: 1024 * 1024 },
  );
  for (const line of output.toString('utf8').split('\n')) {
    const match = /^[ +\-U]?([0-9a-f]{40,64}) (.*)$/.exec(line);
    const oid = match?.[1];
    const rest = match?.[2];
    if (oid === undefined || rest === undefined) continue;
    const path = wanted.find(
      (candidate) => rest === candidate || rest.startsWith(`${candidate} (`),
    );
    if (path !== undefined && !line.startsWith('-')) heads.set(path, oid);
  }
  return heads;
}
