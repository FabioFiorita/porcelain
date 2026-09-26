import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a feature live.ts opens its own WebSocket instead of the shared live socket',
  gate: 'web-lint',
  rule: 'porcelain(web-transport-owner)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/live.ts',
      content:
        "export function probeListen() {\n  return new WebSocket('/api/live');\n}\n",
    },
  ],
} satisfies Probe;
