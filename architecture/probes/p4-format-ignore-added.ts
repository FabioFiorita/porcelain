import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a .prettierignore that hides the features folder from the format check',
  gate: 'web-lint',
  rule: 'style(format-config)',
  edits: [
    {
      kind: 'create',
      path: '.prettierignore',
      content: 'apps/web/src/features\n',
    },
  ],
} satisfies Probe;
