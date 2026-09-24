import { describe, expect, it } from 'vitest';
import { commitPlanOutputSchema } from './parse-commit-plan.ts';

describe('commitPlanOutputSchema', () => {
  it('declares the JSON Schema draft the Claude CLI accepts for --json-schema', () => {
    expect(JSON.parse(commitPlanOutputSchema)).toMatchObject({
      $schema: 'http://json-schema.org/draft-07/schema#',
    });
  });
});
