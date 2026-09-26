import type { Probe } from '../probe.ts';

export default {
  decision: 'P27',
  plants:
    'storage db:check reduced to drizzle-kit check, and a schema column with no migration',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/storage/package.json',
      old: '"db:check": "drizzle-kit check && node scripts/check-migrations.ts"',
      new: '"db:check": "drizzle-kit check"',
    },
    {
      kind: 'replace',
      path: 'packages/storage/src/db/schema/comment-reads.ts',
      old: "  seenThrough: integer('seen_through').notNull(),\n",
      new: "  seenThrough: integer('seen_through').notNull(),\n  probeNote: text('probe_note'),\n",
    },
  ],
} satisfies Probe;
