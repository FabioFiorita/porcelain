import { describe, expect, it } from 'vitest';
import { fixture } from '../../../spec/fixtures/fixture.ts';
import { claudeAnswer, codexAnswer } from './parse-provider-answer.ts';

describe('claudeAnswer', () => {
  it('answers the structured output of a captured Claude reply', () => {
    expect(claudeAnswer(fixture('claude-answer.json'))).toEqual({
      groups: [{ message: 'Add Hello to README', paths: ['README.md'] }],
    });
  });

  it('refuses a Claude reply without structured output, naming the missing field', () => {
    const reply = fixture(
      'claude-answer-without-structured-output-hand-edited.json',
    );
    expect(() => claudeAnswer(reply)).toThrow(/structured_output/);
  });

  it('refuses a Claude reply cut short before its JSON ends', () => {
    const reply = fixture('claude-answer.json');
    expect(() => claudeAnswer(reply.slice(0, reply.length / 2))).toThrow(
      SyntaxError,
    );
  });
});

describe('codexAnswer', () => {
  it('answers the last message of a captured Codex reply', () => {
    expect(codexAnswer(fixture('codex-answer.json'))).toEqual({
      groups: [{ message: 'Add Hello to README.md', paths: ['README.md'] }],
    });
  });
});
