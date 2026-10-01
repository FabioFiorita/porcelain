import type { Probe } from '../probe.ts';

export default {
  decision: 'F1',
  plants:
    'the Git status budget allows one Git process fewer than a status read launches on the perf sample',
  gate: 'verify',
  feature: 'perf.routes',
  rule: 'read the Git status: 10 Git processes are over its budget of 9',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/config/limits.ts',
      old: 'readGitStatus: { p95Ms: 500, gitProcesses: 10 },',
      new: 'readGitStatus: { p95Ms: 500, gitProcesses: 9 },',
    },
  ],
} satisfies Probe;
