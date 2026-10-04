import { describe, expect, it } from 'vitest';
import { assertCurrentAnswer } from './stale-answer.ts';

describe('answers stay with their connected context', () => {
  it('accepts a matching answer on a live connection', () => {
    expect(() =>
      assertCurrentAnswer(new AbortController().signal, true),
    ).not.toThrow();
  });
  it('explains every identity mismatch with one message', () => {
    expect(() =>
      assertCurrentAnswer(new AbortController().signal, false),
    ).toThrow(
      'The connected context changed. Reopen Porcelain to continue safely.',
    );
  });
  it('keeps cancellation as the cause even when identity also changed', () => {
    const controller = new AbortController();
    const reason = new Error('Connection closed');
    controller.abort(reason);
    expect(() => assertCurrentAnswer(controller.signal, false)).toThrow(reason);
  });
});
