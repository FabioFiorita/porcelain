import type { Probe } from '../probe.ts';

export default {
  decision: 'F1',
  plants:
    'the perf fixture stops giving Git its trace target, so every budgeted request counts no Git process and every Git budget passes',
  gate: 'verify',
  feature: 'perf.routes',
  rule: 'git trace: the perf sample recorded no Git process, so its budgets counted nothing',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/spec/kit/sandboxed-server.ts',
      old: '  if (gitTrace !== null)\n    await writeFile(',
      new: "  if (gitTrace === '')\n    await writeFile(",
    },
  ],
} satisfies Probe;
