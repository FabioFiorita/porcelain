import { describe, expect, it } from 'vitest';
import { draftIsStale } from './commit-form.ts';

const looked = {
  statusToken: 'token',
  changes: [],
  files: [
    { path: 'README.md', fingerprint: 'readme-seen' },
    { path: 'notes.md', fingerprint: 'notes-seen' },
    { path: 'gone.md', fingerprint: null },
  ],
};

describe('draftIsStale', () => {
  it('keeps a draft whose files carry the fingerprints the dialog looked at', () => {
    expect(
      draftIsStale(looked, [
        { path: 'README.md', fingerprint: 'readme-seen' },
        { path: 'notes.md', fingerprint: 'notes-seen' },
      ]),
    ).toBe(false);
  });

  it('flags a draft when one of its files was drafted from other content than the dialog looked at', () => {
    expect(
      draftIsStale(looked, [
        { path: 'README.md', fingerprint: 'readme-seen' },
        { path: 'notes.md', fingerprint: 'notes-drafted' },
      ]),
    ).toBe(true);
  });

  it('flags a draft of a file that is no longer a change or has no content to compare', () => {
    expect([
      draftIsStale(looked, [{ path: 'committed.md', fingerprint: 'print' }]),
      draftIsStale(looked, [{ path: 'gone.md', fingerprint: 'print' }]),
    ]).toEqual([true, true]);
  });

  it('ignores changed files the draft did not cover', () => {
    expect(
      draftIsStale(looked, [{ path: 'README.md', fingerprint: 'readme-seen' }]),
    ).toBe(false);
  });
});
