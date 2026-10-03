import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'a web feature rule spec whose case calls the rule and asserts nothing',
  gate: 'test',
  rule: 'Error: expected any number of assertion, but got none',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/rules/probe-label.ts',
      content:
        'export function probeLabel(name: string) {\n  return name.trim();\n}\n',
    },
    {
      kind: 'create',
      path: 'apps/web/src/features/access/rules/probe-label.spec.ts',
      content:
        "import { describe, it } from 'vitest';\nimport { probeLabel } from './probe-label.ts';\n\ndescribe('probeLabel', () => {\n  it('trims the name a user typed', () => {\n    probeLabel(' Porcelain ');\n  });\n});\n",
    },
  ],
} satisfies Probe;
