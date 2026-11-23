import type { UpdateJournal } from './records.ts';

type RecoveryState = {
  journal: UpdateJournal | undefined;
  runtimeExists: boolean;
  previousExists: boolean;
};

type RecoveryPlan =
  | 'nothing'
  | 'discard-previous'
  | 'restore-previous'
  | 'restart-current'
  | 'finish-update'
  | 'finish-rollback'
  | 'unrecoverable';

export function recoveryPlan(state: RecoveryState): RecoveryPlan {
  if (state.journal === undefined)
    return state.runtimeExists && state.previousExists
      ? 'discard-previous'
      : 'nothing';
  if (state.journal.restored === true)
    return state.runtimeExists ? 'finish-rollback' : 'unrecoverable';
  if (state.journal.healthy === true && state.runtimeExists)
    return 'finish-update';
  if (state.previousExists) return 'restore-previous';
  if (state.runtimeExists) return 'restart-current';
  return 'unrecoverable';
}
