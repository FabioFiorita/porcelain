import type { Probe } from '../probe.ts';

export default {
  decision: 'M3',
  plants:
    'the CSS-only theme hides executable code behind its typecheck exemption',
  gate: 'arch',
  rule: 'theme-data-only:',
  edits: [
    {
      kind: 'create',
      path: 'packages/theme/src/runtime.ts',
      content: 'export const runtime = () => Date.now();\n',
    },
  ],
} satisfies Probe;
