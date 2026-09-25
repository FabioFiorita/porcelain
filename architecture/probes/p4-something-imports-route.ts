import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'shared code imports the router module from routes/',
  gate: 'arch',
  rule: 'web-nothing-imports-routes:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/shared/probe-router.ts',
      content:
        "import { createAppRouter } from '../routes/router';\n\nexport const probeRouter = createAppRouter;\n",
    },
  ],
} satisfies Probe;
