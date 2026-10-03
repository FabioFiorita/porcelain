import type { Probe } from '../probe.ts';

export default {
  decision: 'P7',
  plants:
    'a hand edit to the generated route tree: the pair route answers at /pairing, which the route files do not say',
  gate: 'web-lint',
  rule: 'style(route-tree)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/src/routeTree.gen.ts',
      old: "  path: '/pair',\n",
      new: "  path: '/pairing',\n",
    },
  ],
} satisfies Probe;
