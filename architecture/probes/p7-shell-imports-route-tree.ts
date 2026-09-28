import type { Probe } from '../probe.ts';

export default {
  decision: 'P7',
  plants:
    'an app shell file importing the generated route tree, which only main.tsx may import',
  gate: 'arch',
  rule: 'shell-cannot-import-web-entry:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/app/probe-routes.tsx',
      content:
        "import { routeTree } from '../routeTree.gen';\n\nexport function ProbeRoutes() {\n  return <p>{routeTree.id}</p>;\n}\n",
    },
  ],
} satisfies Probe;
