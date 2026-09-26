import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'git read-status.ts caps git status output with its own 8 MiB again instead of the limit the server passes in',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/git/src/inspection/commands/read-status.ts',
      old: 'maxBytes: limits.inspection.statusBytes,',
      new: 'maxBytes: 8 * 1024 * 1024,',
    },
  ],
} satisfies Probe;
