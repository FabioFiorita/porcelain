import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    "a feature view imports another feature's view file instead of its index.ts",
  gate: 'arch',
  rule: 'web-features-import-feature-index:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { ProjectNavigator } from '@/features/projects/views/project-navigator';\n\nexport const probeNavigator = ProjectNavigator;\n",
    },
  ],
} satisfies Probe;
