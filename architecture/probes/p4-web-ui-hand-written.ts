import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a hand-written primitive in components/ui',
  gate: 'arch',
  rule: 'web-shadcn-ui-owner:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/components/ui/action-control.tsx',
      content: 'export const ActionControl = () => <p />;\n',
    },
  ],
} satisfies Probe;
