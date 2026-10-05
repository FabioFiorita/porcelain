import type { ReadServiceUpdateResponse } from '@porcelain/contracts/access';

export type ServiceUpdate = ReadServiceUpdateResponse;

type Outcome =
  | { kind: 'updated'; from: string; target: string }
  | { kind: 'failed'; target: string; reason: string };

export function serviceUpdateProgress(
  state: ServiceUpdate,
  unreachable: boolean,
): string | null {
  if (!state.running) return null;
  const target = state.last?.target ?? state.latest ?? 'the new version';
  if (unreachable || state.last?.stage === 'restarting')
    return `Restarting Porcelain on ${target}. This page reconnects when it is back.`;
  if (state.last?.stage === 'installing') return `Installing ${target}…`;
  return `Downloading ${target}…`;
}

export function serviceUpdateOutcome(state: ServiceUpdate): Outcome | null {
  const { last } = state;
  if (state.running || last == null) return null;
  if (last.stage === 'updated' && last.target === state.version)
    return { kind: 'updated', from: last.from, target: last.target };
  if (last.stage === 'failed')
    return {
      kind: 'failed',
      target: last.target,
      reason: last.reason ?? 'The updater gave no reason.',
    };
  return null;
}
