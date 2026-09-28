import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'shared code imports the pair route from routes/',
  gate: 'arch',
  rule: 'web-nothing-imports-routes:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/shared/probe-router.ts',
      content:
        "import { Route } from '../routes/pair';\n\nexport const probeRoute = Route;\n",
    },
  ],
} satisfies Probe;
