import type { Probe } from '../probe.ts';

export default {
  decision: 'P12b',
  plants:
    'packages/git/tsconfig.json turns noUncheckedIndexedAccess off, and a git spec reads lines[0] unchecked',
  gate: 'lint',
  rule: 'style(tsconfig)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/git/tsconfig.json',
      old: '"lib": ["ES2024"]',
      new: '"lib": ["ES2024"],\n    "noUncheckedIndexedAccess": false',
    },
    {
      kind: 'append',
      path: 'packages/git/src/shared/parsers/oid.spec.ts',
      content:
        "\ndescribe('isOid probe', () => {\n  it('accepts the first line', () => {\n    const lines = [sha1];\n    const first: string = lines[0];\n    expect(isOid(first)).toBe(true);\n  });\n});\n",
    },
  ],
} satisfies Probe;
