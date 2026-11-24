export type DiffRecovery = {
  readonly latestRead: number;
  readonly running: boolean;
  readonly coveredThrough: number;
  readonly produced: readonly number[];
  readonly retried: readonly string[];
};

export type DiffRecoveryStep =
  | { readonly kind: 'idle' }
  | { readonly kind: 'wait' }
  | { readonly kind: 'recover' }
  | { readonly kind: 'retry'; readonly batches: readonly string[] }
  | { readonly kind: 'given-up' };

export const idleDiffRecovery: DiffRecovery = {
  latestRead: 0,
  running: false,
  coveredThrough: 0,
  produced: [],
  retried: [],
};

function recoveryCovers(recovery: DiffRecovery, read: number) {
  return read <= recovery.coveredThrough || recovery.produced.includes(read);
}

export function diffRecoveryStep(
  recovery: DiffRecovery,
  read: number,
  staleBatches: readonly string[],
): DiffRecoveryStep {
  if (staleBatches.length === 0) return { kind: 'idle' };
  if (recovery.running) return { kind: 'wait' };
  if (!recoveryCovers(recovery, read)) return { kind: 'recover' };
  const batches = staleBatches.filter(
    (batch) => !recovery.retried.includes(batch),
  );
  return batches.length > 0 ? { kind: 'retry', batches } : { kind: 'given-up' };
}

export function recoveryPending(step: DiffRecoveryStep) {
  return (
    step.kind === 'wait' || step.kind === 'recover' || step.kind === 'retry'
  );
}

export function stampRead(recovery: DiffRecovery): DiffRecovery {
  const read = recovery.latestRead + 1;
  return recovery.running
    ? { ...recovery, latestRead: read, produced: [...recovery.produced, read] }
    : { ...recovery, latestRead: read };
}

export function beginRecovery(
  recovery: DiffRecovery,
  read: number,
): DiffRecovery | undefined {
  if (recovery.running || recoveryCovers(recovery, read)) return undefined;
  return {
    ...recovery,
    running: true,
    coveredThrough: Math.max(recovery.latestRead, read),
    produced: [],
    retried: [],
  };
}

export function finishRecovery(recovery: DiffRecovery): DiffRecovery {
  return recovery.running ? { ...recovery, running: false } : recovery;
}

export function markRetried(
  recovery: DiffRecovery,
  batches: readonly string[],
): { readonly recovery: DiffRecovery; readonly marked: readonly string[] } {
  const marked = batches.filter((batch) => !recovery.retried.includes(batch));
  return marked.length === 0
    ? { recovery, marked }
    : {
        recovery: { ...recovery, retried: [...recovery.retried, ...marked] },
        marked,
      };
}
