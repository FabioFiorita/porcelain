import type { UpdateFailure } from './page.ts';
import {
  walkthroughPhase,
  type WalkthroughRead,
  type WalkthroughRun,
} from './walkthrough.ts';

const STAGES = [
  'queued',
  'evidence',
  'transcript',
  'writing',
  'validating',
  'ready',
] as const;
const LABELS = {
  queued: 'Queued',
  evidence: 'Reading pull request evidence',
  transcript: 'Reading the coding conversation',
  writing: 'Writing the walkthrough',
  validating: 'Checking the walkthrough',
  ready: 'Walkthrough saved',
  failed: 'Update failed',
};

export function acknowledgedWalkthrough(
  read: WalkthroughRead,
  accepted: WalkthroughRun | undefined,
): WalkthroughRead {
  if (!accepted) return read;
  const latest = read.attempt ?? read.walkthrough;
  if (
    latest &&
    (latest.id === accepted.id ||
      latest.createdAt > accepted.createdAt ||
      latest.branch !== accepted.branch)
  )
    return read;
  if (
    read.walkthrough?.state.status === 'ready' &&
    accepted.state.status !== 'ready'
  )
    return { ...read, attempt: accepted };
  return { walkthrough: accepted, freshness: 'unknown' };
}

export function walkthroughProgress(run: WalkthroughRun, requesting: boolean) {
  const entries = run.progress ?? [];
  const last = entries.at(-1);
  const stage =
    run.state.status === 'failed'
      ? 'failed'
      : run.state.status === 'ready'
        ? 'ready'
        : (last?.stage ??
          (run.state.status === 'queued' ? 'queued' : 'writing'));
  const previous = entries
    .filter((entry) => entry.stage !== 'failed')
    .at(-1)?.stage;
  const completed =
    stage === 'failed'
      ? Math.max(
          0,
          STAGES.findIndex((item) => item === previous),
        )
      : Math.max(
          0,
          STAGES.findIndex((item) => item === stage),
        );
  return {
    label: requesting ? 'Requesting update' : LABELS[stage],
    completed: requesting ? 0 : completed,
    total: STAGES.length - 1,
    entries,
    steps: STAGES.map((item) => LABELS[item]),
    active:
      requesting ||
      run.state.status === 'queued' ||
      run.state.status === 'running',
  };
}

export function walkthroughFreshnessText(
  freshness: WalkthroughRead['freshness'],
) {
  switch (freshness) {
    case 'current':
      return 'Up to date with the current work.';
    case 'unknown':
      return 'Couldn’t check whether the work changed. Your saved walkthrough is still available.';
    case 'changed':
      return 'The work changed after this walkthrough’s snapshot. Update to include the latest changes.';
  }
}

export function acknowledgedWalkthroughPhase(
  phase: ReturnType<typeof walkthroughPhase>,
  accepted: WalkthroughRun | undefined,
) {
  return walkthroughPhase(
    acknowledgedWalkthrough(
      {
        walkthrough: phase.kind === 'unwritten' ? undefined : phase.run,
        attempt: phase.kind === 'ready' ? phase.attempt : undefined,
        freshness: phase.kind === 'ready' ? phase.freshness : 'unknown',
      },
      accepted,
    ),
  );
}

export type WalkthroughStatusInput = {
  run: WalkthroughRun;
  requesting?: boolean;
  reused?: boolean;
  freshness?: WalkthroughRead['freshness'] | undefined;
  failure?: UpdateFailure | undefined;
  onUpdate?: () => void;
};
