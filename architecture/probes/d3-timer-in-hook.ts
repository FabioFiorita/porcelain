import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'the prevent-caching hook waits with a bare setTimeout',
  gate: 'lint',
  rule: 'porcelain(timers-in-runtime)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/hooks/prevent-caching.ts',
      old: "  reply.header('Cache-Control', 'no-store');",
      new: "  reply.header('Cache-Control', 'no-store');\n  await new Promise((resolve) => setTimeout(resolve, 0));",
    },
  ],
} satisfies Probe;
