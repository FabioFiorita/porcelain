import { Cause, Schema } from 'effect';
import { expect, it } from 'vite-plus/test';
import { gitErrorMessage, receiptWords } from './feedback.ts';

it('keeps Git stderr out of a stash refusal', () => {
  expect(
    receiptWords({
      projectId: 'project',
      worktreeId: 'worktree',
      requestId: 'request',
      action: 'stash-pop',
      state: 'rejected',
      reason: 'GIT_REJECTED',
      message: 'error: Local changes would be overwritten\nAborting',
      acceptedAt: '2026-11-26T00:00:00.000Z',
      progress: [],
    }),
  ).toBe('Git could not restore this stash.');
});

it.each([
  [
    'stash-create',
    'CHECKOUT_BUSY',
    'Git cannot change this checkout right now; finish any operation in progress and try again.',
  ],
  ['stash-pop', 'REQUEST_MISMATCH', 'Git could not restore this stash.'],
  [
    'stash-create',
    'UNSUPPORTED_CONFIGURATION',
    'Git could not set these changes aside.',
  ],
] as const)(
  'says a %s refusal for %s in one plain sentence',
  (action, reason, words) => {
    expect(
      receiptWords({
        projectId: 'project',
        worktreeId: 'worktree',
        requestId: 'request',
        action,
        state: 'rejected',
        reason,
        message: 'fatal: Unable to create index.lock: File exists',
        acceptedAt: '2026-11-26T00:00:00.000Z',
        progress: [],
      }),
    ).toBe(words);
  },
);

it('gives a plain message when an action reply cannot be decoded', () => {
  const reply = Schema.decodeUnknownExit(
    Schema.Struct({ requestId: Schema.String }),
  )({});
  expect(reply._tag).toBe('Failure');
  if (reply._tag !== 'Failure') throw new Error('Expected an invalid reply');
  expect(gitErrorMessage(Cause.squash(reply.cause))).toBe(
    'Git could not complete this action.',
  );
});
