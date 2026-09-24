import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'contracts inventory.ts caps a project name at its own 100 again instead of the named limit in contracts/shared/limits.ts',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/contracts/src/projects/inventory.ts',
      old: '.max(PROJECT_NAME_LENGTH)',
      new: '.max(100)',
    },
  ],
} satisfies Probe;
