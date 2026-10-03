import { describe, expect, it } from 'vitest';
import { commitPlanParser } from './parse-commit-plan.ts';

const parser = commitPlanParser({
  maxGroups: 2,
  maxMessageLength: 40,
  maxPathLength: 20,
  maxPaths: 3,
});

describe('commitPlanParser', () => {
  it('declares the JSON Schema draft the Claude CLI accepts for --json-schema', () => {
    expect(JSON.parse(parser.outputSchema)).toMatchObject({
      $schema: 'http://json-schema.org/draft-07/schema#',
    });
  });

  it('answers the groups of a plan within the limits', () => {
    expect(
      parser.parse({ groups: [{ message: 'Fix', paths: ['README.md'] }] }),
    ).toEqual([{ message: 'Fix', paths: ['README.md'] }]);
  });

  it('refuses a plan with more groups than allowed', () => {
    const group = { message: 'Fix', paths: ['README.md'] };
    expect(() => parser.parse({ groups: [group, group, group] })).toThrow(
      expect.objectContaining({ name: 'CommitPlanFailedError' }),
    );
  });
});
