import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a feature rule reads the window',
  gate: 'web-lint',
  rule: 'porcelain(web-rules-are-pure)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/rules/probe-rule.ts',
      content:
        'export function probeWidth() {\n  return window.innerWidth;\n}\n',
    },
  ],
} satisfies Probe;
