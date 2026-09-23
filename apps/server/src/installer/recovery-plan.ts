import type { UpdateJournal } from './records.ts';

export type RecoveryState = {
  journal: UpdateJournal | undefined;
  runtimeExists: boolean;
  previousExists: boolean;
};

export type RecoveryPlan =
  | 'nothing'
  | 'discard-previous'
  | 'restore-previous'
  | 'restart-current'
  | 'unrecoverable';

export function recoveryPlan(state: RecoveryState): RecoveryPlan {
  if (state.journal === undefined)
    return state.runtimeExists && state.previousExists
      ? 'discard-previous'
      : 'nothing';
  if (state.previousExists) return 'restore-previous';
  if (state.runtimeExists) return 'restart-current';
  return 'unrecoverable';
}
