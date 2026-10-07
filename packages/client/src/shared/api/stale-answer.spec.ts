import { Cause, Effect, Exit } from 'effect';
import { describe, expect, it } from 'vitest';
import { currentAnswerEffect } from './stale-answer.ts';

describe('answers stay with their connected context', () => {
  it('accepts a matching answer on a live connection', async () => {
    expect(
      await Effect.runPromise(currentAnswerEffect({ isClosed: () => false })),
    ).toBeUndefined();
  });
  it('explains every identity mismatch with one message', async () => {
    await expect(
      Effect.runPromise(currentAnswerEffect({ isClosed: () => false }, false)),
    ).rejects.toThrow(
      'The connected context changed. Reopen Porcelain to continue safely.',
    );
  });
  it('keeps native interruption even when identity also changed', async () => {
    let closed = false;
    const answer = currentAnswerEffect({ isClosed: () => closed }, false);
    closed = true;
    const exit = await Effect.runPromiseExit(answer);
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true,
    );
  });
});
