import { runInspection } from './run-inspection.ts';

export async function readUpstreamOid(
  checkout: string,
  upstream: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const output = await runInspection(
    checkout,
    ['rev-parse', '--verify', `${upstream}^{commit}`],
    signal,
    { maxBytes: 1024 },
  );
  return output.toString('utf8').trimEnd() || null;
}
