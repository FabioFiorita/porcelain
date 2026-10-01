import type { Probe } from '../probe.ts';

export default {
  decision: 'F1',
  plants:
    'the Git status budget allows one Git process fewer than a status read launches on the perf sample',
  gate: 'verify',
  feature: 'perf.routes',
  rule: 'read the Git status: 9 Git processes are over its budget of 8',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/config/limits.ts',
      old: 'readGitStatus: { p95Ms: 400, gitProcesses: 9 },',
      new: 'readGitStatus: { p95Ms: 400, gitProcesses: 8 },',
    },
  ],
} satisfies Probe;
