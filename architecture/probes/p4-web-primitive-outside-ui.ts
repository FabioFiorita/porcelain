import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a local Button in a feature view',
  gate: 'arch',
  rule: 'web-shadcn-primitive-owner:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/button.tsx',
      content: 'export const Button = () => <p />;\n',
    },
  ],
} satisfies Probe;
