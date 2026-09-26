import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'mutable module state outside a feature store',
  gate: 'web-lint',
  rule: 'porcelain(web-no-module-mutable-binding)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/rules/probe-rule.ts',
      content:
        'let generation = 0;\nexport function nextGeneration() { return ++generation; }\n',
    },
  ],
} satisfies Probe;
