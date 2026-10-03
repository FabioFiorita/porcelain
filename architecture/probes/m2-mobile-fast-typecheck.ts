import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants:
    'the mobile typecheck script is removed, so Turborepo runs no mobile typecheck in the fast check',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/mobile/package.json',
      old: '    "typecheck": "tsc --noEmit",\n',
      new: '',
    },
  ],
} satisfies Probe;
