import type { Probe } from '../probe.ts';

export default {
  decision: 'P11',
  plants:
    '0003_pairing_and_devices.sql, already shipped, gains a create and drop; every existing database would refuse to open',
  gate: 'db',
  rule: 'Shipped migration edited: 0003_pairing_and_devices.sql',
  edits: [
    {
      kind: 'append',
      path: 'packages/storage/drizzle/0003_pairing_and_devices.sql',
      content:
        '\n--> statement-breakpoint\nCREATE TABLE `probe_edit` (`id` integer);\n--> statement-breakpoint\nDROP TABLE `probe_edit`;\n',
    },
  ],
} satisfies Probe;
