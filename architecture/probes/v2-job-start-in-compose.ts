import type { Probe } from '../probe.ts';

export default {
  decision: 'V2',
  plants:
    'bootstrap/compose-server.ts: `for (const job of jobs) job.start();` before the application is returned',
  gate: 'lint',
  rule: 'porcelain(bootstrap-starts-nothing)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/bootstrap/compose-server.ts',
      old: '  const useCases = {',
      new: `  for (const job of jobs) job.start();
  const useCases = {`,
    },
  ],
} satisfies Probe;
