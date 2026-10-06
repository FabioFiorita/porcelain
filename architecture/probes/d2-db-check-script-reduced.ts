import type { Probe } from '../probe.ts';

export default {
  decision: 'P27',
  plants:
    'storage db:check redirected to an unrelated script, and a native SQL model column with no migration',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/storage/package.json',
      old: '"db:check": "node scripts/check-migrations.ts"',
      new: '"db:check": "node scripts/unrelated-check.ts"',
    },
    {
      kind: 'replace',
      path: 'packages/storage/src/db/models/comment-reads.ts',
      old: '  seenThrough: Schema.Int,\n',
      new: '  seenThrough: Schema.Int,\n  probeNote: Schema.NullOr(Schema.String),\n',
    },
  ],
} satisfies Probe;
