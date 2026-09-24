import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'a route file directly under http/routes/ instead of http/routes/<feature>/<operation>.ts',
  gate: 'arch',
  rule: 'flat-http-route:',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/http/routes/probe-flat.ts',
      content: '',
    },
  ],
} satisfies Probe;
