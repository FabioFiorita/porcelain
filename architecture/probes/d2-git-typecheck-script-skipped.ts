import type { Probe } from '../probe.ts';

export default {
  decision: 'P13b',
  plants:
    'packages/git/package.json typecheck runs true, and a git spec assigns a string to a number',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/git/package.json',
      old: '"typecheck": "tsc --noEmit"',
      new: '"typecheck": "true"',
    },
    {
      kind: 'append',
      path: 'packages/git/src/shared/parsers/oid.spec.ts',
      content:
        "\ndescribe('isOid probe', () => {\n  it('counts seven', () => {\n    const count: number = 'seven';\n    expect(count).toBe('seven');\n  });\n});\n",
    },
  ],
} satisfies Probe;
