import type { ExpectedFile } from './changes.ts';

export type RecoverySnapshot = {
  readonly statusToken: string;
  readonly fingerprints: ReadonlyMap<string, string | undefined>;
};

export type DiffRecovery = {
  readonly latestRead: number;
  readonly snapshot: RecoverySnapshot;
  readonly generation: number;
  readonly running: boolean;
  readonly coveredThrough: number;
  readonly produced: readonly number[];
  readonly retried: readonly string[];
  readonly inFlight: readonly string[];
};

export type StaleBatch = {
  readonly key: string;
  readonly statusToken: string;
  readonly expectedFiles: readonly ExpectedFile[];
  readonly waiting: boolean;
};

export type RetryTicket = {
  readonly generation: number;
  readonly read: number;
};

export type DiffRecoveryStep =
  | { readonly kind: 'idle' }
  | { readonly kind: 'wait' }
  | { readonly kind: 'recover' }
  | {
      readonly kind: 'retry';
      readonly batches: readonly string[];
      readonly ticket: RetryTicket;
    }
  | { readonly kind: 'superseded' }
  | { readonly kind: 'given-up' };

export const idleDiffRecovery: DiffRecovery = {
  latestRead: 0,
  snapshot: { statusToken: '', fingerprints: new Map() },
  generation: 0,
  running: false,
  coveredThrough: 0,
  produced: [],
  retried: [],
  inFlight: [],
};

function recoveryCovers(recovery: DiffRecovery, read: number) {
  return read <= recovery.coveredThrough || recovery.produced.includes(read);
}

function matchesSnapshot(snapshot: RecoverySnapshot, batch: StaleBatch) {
  return (
    batch.statusToken === snapshot.statusToken &&
    batch.expectedFiles.every(
      (file) =>
        snapshot.fingerprints.has(file.path) &&
        snapshot.fingerprints.get(file.path) === file.fingerprint,
    )
  );
}

export function diffRecoveryStep(
  recovery: DiffRecovery,
  read: number,
  stale: readonly StaleBatch[],
): DiffRecoveryStep {
  if (stale.length === 0) return { kind: 'idle' };
  if (
    recovery.running ||
    stale.some(
      (batch) => batch.waiting || recovery.inFlight.includes(batch.key),
    )
  )
    return { kind: 'wait' };
  if (!recoveryCovers(recovery, read)) return { kind: 'recover' };
  const current =
    read < recovery.latestRead
      ? stale.filter((batch) => matchesSnapshot(recovery.snapshot, batch))
      : stale;
  const batches = current
    .map((batch) => batch.key)
    .filter((key) => !recovery.retried.includes(key));
  if (batches.length > 0)
    return {
      kind: 'retry',
      batches,
      ticket: { generation: recovery.generation, read: recovery.latestRead },
    };
  return current.length < stale.length
    ? { kind: 'superseded' }
    : { kind: 'given-up' };
}

export function recoveryPending(step: DiffRecoveryStep) {
  return step.kind !== 'idle' && step.kind !== 'given-up';
}

export function stampRead(
  recovery: DiffRecovery,
  snapshot: RecoverySnapshot,
): DiffRecovery {
  const read = recovery.latestRead + 1;
  return {
    ...recovery,
    latestRead: read,
    snapshot,
    produced: recovery.running
      ? [...recovery.produced, read]
      : recovery.produced,
  };
}

export function beginRecovery(
  recovery: DiffRecovery,
  read: number,
): DiffRecovery | undefined {
  if (recovery.running || recoveryCovers(recovery, read)) return undefined;
  return {
    ...recovery,
    generation: recovery.generation + 1,
    running: true,
    coveredThrough: Math.max(recovery.latestRead, read),
    produced: [],
    retried: [],
    inFlight: [],
  };
}

export function finishRecovery(recovery: DiffRecovery): DiffRecovery {
  return recovery.running ? { ...recovery, running: false } : recovery;
}

export function claimRetry(
  recovery: DiffRecovery,
  ticket: RetryTicket,
  batches: readonly string[],
): { readonly recovery: DiffRecovery; readonly marked: readonly string[] } {
  const marked =
    recovery.running ||
    recovery.generation !== ticket.generation ||
    recovery.latestRead !== ticket.read
      ? []
      : batches.filter((batch) => !recovery.retried.includes(batch));
  return marked.length === 0
    ? { recovery, marked }
    : {
        recovery: {
          ...recovery,
          retried: [...recovery.retried, ...marked],
          inFlight: [...recovery.inFlight, ...marked],
        },
        marked,
      };
}

export function settleRetry(
  recovery: DiffRecovery,
  ticket: RetryTicket,
  batch: string,
): DiffRecovery {
  return recovery.generation === ticket.generation &&
    recovery.inFlight.includes(batch)
    ? {
        ...recovery,
        inFlight: recovery.inFlight.filter((key) => key !== batch),
      }
    : recovery;
}
