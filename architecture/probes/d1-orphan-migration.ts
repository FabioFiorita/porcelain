import type { Probe } from '../probe.ts';

export default {
  decision: 'P10',
  plants:
    'an orphan 0015 migration with no journal entry or snapshot, which drizzle silently ignores',
  gate: 'db',
  rule: 'Migration outside the journal: 0015_probe_orphan.sql',
  edits: [
    {
      kind: 'create',
      path: 'packages/storage/drizzle/0015_probe_orphan.sql',
      content: 'CREATE TABLE `probe_orphan` (`id` integer);\n',
    },
  ],
} satisfies Probe;
