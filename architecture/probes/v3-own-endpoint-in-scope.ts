import type { Probe } from '../probe.ts';

export default {
  decision: 'V3',
  plants:
    "http/scopes/paired.ts: server.get('/debug/lanes', async () => ({ ok: true })) registered straight in the scope",
  gate: 'lint',
  rule: 'porcelain(scope-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/scopes/paired.ts',
      old: `  server.addHook('onRequest', authenticate(options.application));
`,
      new: `  server.addHook('onRequest', authenticate(options.application));
  server.get('/debug/lanes', async () => ({ ok: true }));
`,
    },
  ],
} satisfies Probe;
