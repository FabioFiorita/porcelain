import { describe, expect, it } from 'vitest';
import { recoveryPlan } from './recovery-plan.ts';

const journal = { installed: { version: '1.0.0' }, backup: '/backups/one' };

describe('recovery plan', () => {
  it('leaves a healthy installation alone', () => {
    expect(
      recoveryPlan({
        journal: undefined,
        runtimeExists: true,
        previousExists: false,
      }),
    ).toBe('nothing');
  });

  it('discards a leftover previous runtime when no update was in progress', () => {
    expect(
      recoveryPlan({
        journal: undefined,
        runtimeExists: true,
        previousExists: true,
      }),
    ).toBe('discard-previous');
  });

  it('restores the previous runtime when an update left it behind', () => {
    expect(
      recoveryPlan({ journal, runtimeExists: true, previousExists: true }),
    ).toBe('restore-previous');
    expect(
      recoveryPlan({ journal, runtimeExists: false, previousExists: true }),
    ).toBe('restore-previous');
  });

  it('restarts the current runtime when the update never moved it', () => {
    expect(
      recoveryPlan({ journal, runtimeExists: true, previousExists: false }),
    ).toBe('restart-current');
  });

  it('gives up when neither runtime survived', () => {
    expect(
      recoveryPlan({ journal, runtimeExists: false, previousExists: false }),
    ).toBe('unrecoverable');
  });
});
