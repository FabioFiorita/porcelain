import { Schema } from 'effect';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceLocationSchema = Schema.Struct({
  name: Schema.String,
  start: Schema.Finite,
});
const reportSchema = Schema.Struct({
  duplicates: Schema.Array(
    Schema.Struct({
      lines: Schema.Finite,
      firstFile: sourceLocationSchema,
      secondFile: sourceLocationSchema,
    }),
  ),
  statistics: Schema.Struct({
    total: Schema.Struct({
      clones: Schema.Finite,
      duplicatedLines: Schema.Finite,
      percentage: Schema.Finite,
    }),
  }),
});
export function duplicateScope() {
  return {
    name: 'web',
    sources: ['apps/web/src'],
    metric: 'clones' as const,
    ceiling: 0,
    why: 'Keep web logic in one owner so fixes cannot drift between copies.',
  };
}
export function scanDuplicates(
  from: string,
  scope: {
    sources: readonly string[];
    metric: 'clones' | 'duplicatedLines';
    ceiling: number;
  },
) {
  const scratch = mkdtempSync(join(tmpdir(), 'porcelain-duplicates-'));
  try {
    const result = spawnSync(
      join(root, 'node_modules/.bin/jscpd'),
      [
        '--format',
        'typescript,tsx',
        '--min-tokens',
        '50',
        '--min-lines',
        '5',
        '--mode',
        'mild',
        '--ignore',
        '**/components/ui/**,**/routeTree.gen.ts,**/*.spec.ts',
        '--absolute',
        '--no-colors',
        '--reporters',
        'json',
        '--output',
        scratch,
        ...scope.sources,
      ],
      { cwd: from, encoding: 'utf8' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`jscpd failed:\n${result.stdout}${result.stderr}`);
    const report = Schema.decodeUnknownSync(reportSchema)(
      JSON.parse(readFileSync(join(scratch, 'jscpd-report.json'), 'utf8')),
    );
    const count = report.statistics.total[scope.metric];
    return {
      ...report,
      count,
      exceeded: count > scope.ceiling,
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
