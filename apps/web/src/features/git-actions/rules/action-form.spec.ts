import { describe, expect, it } from 'vitest';
import { actionFormInput } from './action-form.ts';

const fields = {
  message: 'Porcelain review',
  stashOid: 'a'.repeat(40),
  option: true,
};

describe('actionFormInput', () => {
  it('stashes with the message and includes untracked files only when the option is on', () => {
    expect(
      actionFormInput('stash-create', { ...fields, option: false }),
    ).toEqual({
      action: 'stash-create',
      message: 'Porcelain review',
      includeUntracked: false,
    });
  });

  it('applies or pops the chosen stash, restoring the index when the option is on', () => {
    expect(actionFormInput('stash-apply', fields)).toEqual({
      action: 'stash-apply',
      stashOid: 'a'.repeat(40),
      restoreIndex: true,
    });
    expect(actionFormInput('stash-pop', { ...fields, option: false })).toEqual({
      action: 'stash-pop',
      stashOid: 'a'.repeat(40),
      restoreIndex: false,
    });
  });
});
