import {
  checkDurationLabel,
  checkProgress,
  checkState,
  elapsedMs,
  failingStep,
  stepState,
  type PullCheck,
  type PullCheckStep,
} from '@porcelain/client/projects/rules';

export function checkRowDetail(
  check: PullCheck,
  requested: boolean,
  now: number,
) {
  const duration = checkDurationLabel(
    elapsedMs(check.startedAt, check.completedAt, now),
  );
  const parts = (...values: (string | undefined)[]) =>
    values.filter(Boolean).join(' · ') || undefined;
  const required = check.required ? 'Required' : undefined;
  if (requested) return parts(required, 'Re-run requested');
  if (checkState(check) === 'running') {
    const progress = checkProgress(check);
    return progress
      ? parts(
          required,
          `Step ${progress.position} of ${progress.total}`,
          progress.step.name,
          duration,
        )
      : parts(required, 'Queued');
  }
  const failed = failingStep(check);
  return parts(
    required,
    failed ? `Step ${failed.number}` : undefined,
    failed?.name,
    duration,
  );
}

export function stepDetail(step: PullCheckStep, now: number) {
  const duration = checkDurationLabel(
    elapsedMs(step.startedAt, step.completedAt, now),
  );
  return stepState(step) === 'running'
    ? `running ${duration ?? ''}`.trim()
    : duration;
}

export function stepHasLog(step: PullCheckStep) {
  const state = stepState(step);
  return state === 'passed' || state === 'failed';
}
