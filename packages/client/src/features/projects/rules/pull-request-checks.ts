import type {
  PullCheckDetail,
  PullRequestStatus,
} from '@porcelain/contracts/projects';
export type {
  CheckLogLine,
  PullRequestRerunTarget,
  ReadCheckLogResponse,
} from '@porcelain/contracts/projects';
export { PULL_REQUEST_COMMENT_CHARACTERS } from '@porcelain/contracts/projects';

export type PullCheck = PullCheckDetail;
export type PullStatus = PullRequestStatus;
export type PullCheckStep = PullCheck['steps'][number];
export type CheckState = 'failed' | 'running' | 'passed' | 'skipped';
export type StepState = CheckState | 'pending';

const FAILED = new Set([
  'FAILURE',
  'ERROR',
  'CANCELLED',
  'TIMED_OUT',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
  'STALE',
]);
const SKIPPED = new Set(['SKIPPED', 'NEUTRAL']);

export function checkState(check: {
  readonly status: string;
  readonly conclusion?: string | undefined;
}): CheckState {
  if (check.status !== 'COMPLETED' || check.conclusion === 'EXPECTED')
    return 'running';
  if (FAILED.has(check.conclusion ?? '')) return 'failed';
  if (SKIPPED.has(check.conclusion ?? '')) return 'skipped';
  return 'passed';
}

export function stepState(step: PullCheckStep): StepState {
  if (step.status === 'IN_PROGRESS') return 'running';
  if (step.status !== 'COMPLETED') return 'pending';
  return checkState(step);
}

export type CheckGroup = {
  readonly key: string;
  readonly name: string;
  readonly runId: number | undefined;
  readonly state: CheckState;
  readonly failed: readonly PullCheck[];
  readonly running: readonly PullCheck[];
  readonly passed: readonly PullCheck[];
};

const ORDER: Record<CheckState, number> = {
  failed: 0,
  running: 1,
  passed: 2,
  skipped: 2,
};

export function groupChecks(checks: readonly PullCheck[]): CheckGroup[] {
  const groups = new Map<
    string,
    { name: string; runId: number | undefined; checks: PullCheck[] }
  >();
  for (const check of checks) {
    const key =
      check.kind === 'actions' && check.runId !== undefined
        ? `run:${check.runId}`
        : `group:${check.group}`;
    const group = groups.get(key) ?? {
      name: check.group,
      runId: check.kind === 'actions' ? check.runId : undefined,
      checks: [],
    };
    group.checks.push(check);
    groups.set(key, group);
  }
  return [...groups]
    .map(([key, group]) => {
      const failed = group.checks.filter(
        (check) => checkState(check) === 'failed',
      );
      const running = group.checks.filter(
        (check) => checkState(check) === 'running',
      );
      const passed = group.checks.filter(
        (check) => ORDER[checkState(check)] === 2,
      );
      const state: CheckState =
        failed.length > 0
          ? 'failed'
          : running.length > 0
            ? 'running'
            : 'passed';
      return {
        key,
        name: group.name,
        runId: group.runId,
        state,
        failed,
        running,
        passed,
      };
    })
    .map((group, index) => ({ group, index }))
    .sort(
      (a, b) =>
        ORDER[a.group.state] - ORDER[b.group.state] || a.index - b.index,
    )
    .map(({ group }) => group);
}

export function checkCounts(checks: readonly PullCheck[]) {
  const counts = { failed: 0, running: 0, passed: 0 };
  for (const check of checks) {
    const state = checkState(check);
    if (state === 'failed') counts.failed++;
    else if (state === 'running') counts.running++;
    else counts.passed++;
  }
  return counts;
}

export function checkProgress(
  check: PullCheck,
): { step: PullCheckStep; position: number; total: number } | undefined {
  if (checkState(check) !== 'running') return undefined;
  const index = check.steps.findIndex((step) => stepState(step) === 'running');
  const step = check.steps[index];
  if (step === undefined) return undefined;
  return { step, position: index + 1, total: check.steps.length };
}

export function failingStep(check: PullCheck): PullCheckStep | undefined {
  return check.steps.find((step) => stepState(step) === 'failed');
}

export function elapsedMs(
  startedAt: string | undefined,
  completedAt: string | undefined,
  now: number,
): number | undefined {
  if (startedAt === undefined) return undefined;
  const start = Date.parse(startedAt);
  const end = completedAt === undefined ? now : Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
    return undefined;
  return end - start;
}

export function checkDurationLabel(ms: number | undefined) {
  if (ms === undefined) return undefined;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export type RerunOffer =
  | { readonly kind: 'available'; readonly confirm: boolean }
  | { readonly kind: 'unavailable'; readonly reason: string };

function runBusy(status: PullStatus, runId: number | undefined) {
  return status.checks.some(
    (check) =>
      check.kind === 'actions' &&
      check.runId === runId &&
      checkState(check) === 'running',
  );
}

function rerunRefusal(status: PullStatus, check: PullCheck) {
  if (check.kind !== 'actions')
    return 'Only GitHub Actions jobs can be re-run from here.';
  if (!status.canRerun)
    return 'Your GitHub account cannot re-run workflows in this repository.';
  if (status.state !== 'open') return 'The pull request is not open.';
  if (runBusy(status, check.runId))
    return 'GitHub re-runs a workflow only after all of its jobs finish.';
  return undefined;
}

export function jobRerunOffer(
  status: PullStatus,
  check: PullCheck,
): RerunOffer {
  const reason = rerunRefusal(status, check);
  if (reason !== undefined) return { kind: 'unavailable', reason };
  const siblings = status.checks.some(
    (other) =>
      other.kind === 'actions' &&
      other.runId === check.runId &&
      other.key !== check.key,
  );
  return {
    kind: 'available',
    confirm: checkState(check) !== 'failed' && siblings,
  };
}

export function failedJobsRerunOffer(
  status: PullStatus,
  group: CheckGroup,
): RerunOffer | undefined {
  const failed = group.failed.find((check) => check.kind === 'actions');
  if (group.runId === undefined || failed === undefined) return undefined;
  const reason = rerunRefusal(status, failed);
  if (reason !== undefined) return { kind: 'unavailable', reason };
  return { kind: 'available', confirm: false };
}

export type RequestedRerun = {
  readonly key: string;
  readonly jobId: number | undefined;
  readonly at: number;
};

const RERUN_WAIT_MS = 3 * 60_000;

export function rerunsStillPending(
  status: PullStatus,
  requested: readonly RequestedRerun[],
  now: number,
): RequestedRerun[] {
  return requested.filter((request) => {
    if (now - request.at > RERUN_WAIT_MS) return false;
    const check = status.checks.find((entry) => entry.key === request.key);
    return (
      check !== undefined &&
      check.jobId === request.jobId &&
      checkState(check) !== 'running'
    );
  });
}

const POLL_MIN_MS = 20_000;
const POLL_MAX_MS = 120_000;

export function nextPollDelay(
  previousMs: number | undefined,
  changed: boolean,
) {
  if (previousMs === undefined || changed) return POLL_MIN_MS;
  return Math.min(POLL_MAX_MS, Math.round(previousMs * 1.5));
}

export function statusFingerprint(status: PullStatus) {
  return [
    status.headSha,
    status.mergeable,
    status.mergeState ?? '',
    status.reviewDecision ?? '',
    ...status.checks.map(
      (check) =>
        `${check.key}|${check.jobId ?? ''}|${check.status}|${check.conclusion ?? ''}|${checkProgress(check)?.position ?? ''}`,
    ),
  ].join('\n');
}

export function statusIsMoving(status: PullStatus) {
  return status.checks.some((check) => checkState(check) === 'running');
}

export type MergeBlocker = {
  readonly key: string;
  readonly tone: 'failed' | 'running' | 'none';
  readonly text: string;
  readonly checkKey?: string | undefined;
};

function reviewers(names: readonly string[]) {
  if (names.length === 0) return '';
  if (names.length <= 2) return ` from ${names.join(' and ')}`;
  return ` from ${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

export function pullRequestBlockers(
  status: PullStatus,
  baseBranch: string,
  mergeMethods?: readonly string[],
): MergeBlocker[] {
  if (status.state !== 'open') return [];
  const blockers: MergeBlocker[] = [];
  if (mergeMethods?.length === 0)
    blockers.push({
      key: 'methods',
      tone: 'none',
      text: 'This repository allows no merge method.',
    });
  if (status.draft)
    blockers.push({
      key: 'draft',
      tone: 'none',
      text: 'Draft. Mark it ready for review on GitHub.',
    });
  if (status.mergeable === 'CONFLICTING')
    blockers.push({
      key: 'conflicts',
      tone: 'failed',
      text: `Conflicts with ${baseBranch}.`,
    });
  else if (status.mergeState === 'BEHIND')
    blockers.push({
      key: 'behind',
      tone: 'none',
      text: `Behind ${baseBranch}. Update the branch before merging.`,
    });
  const failed = status.checks.filter(
    (check) => checkState(check) === 'failed',
  );
  for (const check of failed.slice(0, 3)) {
    const step = failingStep(check);
    blockers.push({
      key: `check:${check.key}`,
      tone: 'failed',
      checkKey: check.key,
      text: `${check.name}${check.required ? ' (required)' : ''} failed${step ? ` at step ${step.number}: ${step.name}` : ''}.`,
    });
  }
  if (failed.length > 3)
    blockers.push({
      key: 'check:more',
      tone: 'failed',
      checkKey: failed[3]?.key,
      text: `${failed.length - 3} more ${failed.length - 3 === 1 ? 'check' : 'checks'} failed.`,
    });
  const running = status.checks.filter(
    (check) => checkState(check) === 'running',
  );
  const first = running[0];
  if (first !== undefined) {
    const progress = checkProgress(first);
    blockers.push({
      key: 'running',
      tone: 'running',
      checkKey: first.key,
      text:
        running.length === 1
          ? `${first.name} is running${progress ? `, step ${progress.position} of ${progress.total}` : ''}.`
          : `${running.length} checks are running.`,
    });
  }
  if (status.checksTruncated)
    blockers.push({
      key: 'truncated',
      tone: 'none',
      text: 'More than 100 checks; open GitHub to see them all.',
    });
  if (status.reviewDecision === 'CHANGES_REQUESTED')
    blockers.push({
      key: 'review',
      tone: 'failed',
      text: 'Changes requested.',
    });
  else if (status.reviewDecision === 'REVIEW_REQUIRED')
    blockers.push({
      key: 'review',
      tone: 'none',
      text: `Review required${reviewers(status.requestedReviewers)}.`,
    });
  if (blockers.length === 0 && status.mergeState === 'BLOCKED')
    blockers.push({
      key: 'blocked',
      tone: 'none',
      text: 'A branch rule on GitHub blocks the merge.',
    });
  return blockers;
}

export function checkCitations(
  steps: readonly {
    readonly number: number;
    readonly names: readonly string[];
  }[],
): ReadonlyMap<string, number> {
  const cited = new Map<string, number>();
  for (const step of steps)
    for (const name of step.names)
      if (!cited.has(name)) cited.set(name, step.number);
  return cited;
}
