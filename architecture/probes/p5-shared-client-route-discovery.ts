import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the feature-map check stops reading the shared client api layer the web calls through',
  gate: 'features',
  rule: '.agents/skills/web-verify/features/access.pairing.md: api POST /api/pair is a route the web never calls',
  edits: [
    {
      kind: 'replace',
      path: 'scripts/feature-maps.ts',
      old: "      ['apps/web/src', 'packages/client/src'],\n",
      new: "      ['apps/web/src'],\n",
    },
  ],
} satisfies Probe;
