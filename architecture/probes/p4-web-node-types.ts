import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'apps/web/tsconfig.json takes Node types back, so browser code compiles against Node globals',
  gate: 'web-lint',
  rule: 'style(tsconfig)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/tsconfig.json',
      old: '"types": ["vite/client"]',
      new: '"types": ["vite/client", "node"]',
    },
  ],
} satisfies Probe;
