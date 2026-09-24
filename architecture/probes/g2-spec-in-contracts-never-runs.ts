import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants:
    'packages/projects/spec/contracts/probe-never-runs.spec.ts asserting expect(1).toBe(2)',
  gate: 'test',
  rule: 'expected 1 to be 2',
  edits: [
    {
      kind: 'create',
      path: 'packages/projects/spec/contracts/probe-never-runs.spec.ts',
      content: `import { describe, expect, it } from 'vitest';

describe('probe', () => {
  it('fails when it runs', () => {
    expect(1).toBe(2);
  });
});
`,
    },
  ],
} satisfies Probe;
