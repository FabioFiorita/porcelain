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
