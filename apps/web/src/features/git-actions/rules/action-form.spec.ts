import { describe, expect, it } from 'vitest';
import { actionFormInput } from './action-form.ts';

const fields = {
  message: 'Porcelain review',
  remoteName: 'origin',
  ref: 'refs/heads/main',
  stashOid: 'a'.repeat(40),
  option: true,
  strategy: 'merge' as const,
};

describe('actionFormInput', () => {
  it('pushes to the entered remote and ref, creating it when the option is on', () => {
    expect(actionFormInput('push', fields)).toEqual({
      action: 'push',
      remoteName: 'origin',
      destinationRef: 'refs/heads/main',
      allowCreate: true,
    });
  });

  it('pulls the entered ref with the chosen strategy', () => {
    expect(actionFormInput('pull', fields)).toEqual({
      action: 'pull',
      remoteName: 'origin',
      sourceRef: 'refs/heads/main',
      strategy: 'merge',
    });
  });

  it('fetches the entered ref without a strategy', () => {
    expect(actionFormInput('fetch', fields)).toEqual({
      action: 'fetch',
      remoteName: 'origin',
      sourceRef: 'refs/heads/main',
    });
  });

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
