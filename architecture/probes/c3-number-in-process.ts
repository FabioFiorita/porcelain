import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'process run-command.ts polls the process group every 10 ms of its own again instead of the interval the caller passes in',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/process/src/run-command.ts',
      old: 'await delay(group.pollMs);',
      new: 'await delay(10);',
    },
  ],
} satisfies Probe;
