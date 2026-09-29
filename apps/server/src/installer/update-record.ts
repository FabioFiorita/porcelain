import type { UpdateRecord } from './records.ts';
import { isVersion } from './version-policy.ts';

type PresentedUpdate = {
  from: string;
  target: string;
  stage: UpdateRecord['stage'];
  reason: string | undefined;
};

const unfinished = new Set(['downloading', 'installing', 'restarting']);

export const STOPPED_EARLY = 'The update stopped before it finished';

export function presentedUpdate(
  record: UpdateRecord | undefined,
  running: boolean,
): PresentedUpdate | undefined {
  if (record === undefined) return undefined;
  const stopped = unfinished.has(record.stage) && !running;
  return {
    from: record.from,
    target: record.target,
    stage: stopped ? 'failed' : record.stage,
    reason: stopped ? STOPPED_EARLY : record.reason,
  };
}

export function publishedVersion(output: string): string | undefined {
  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    return undefined;
  }
  return typeof value === 'string' && isVersion(value) ? value : undefined;
}
