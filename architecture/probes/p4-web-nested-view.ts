import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view nested in a subfolder of views/',
  gate: 'arch',
  rule: 'role-folder-is-flat:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/panel/probe-view.tsx',
      content: 'export const ProbeView = () => <p />;\n',
    },
  ],
} satisfies Probe;
