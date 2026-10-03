import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportSchema = z.object({
  duplicates: z.array(
    z.object({
      lines: z.number(),
      firstFile: z.object({ name: z.string(), start: z.number() }),
      secondFile: z.object({ name: z.string(), start: z.number() }),
    }),
  ),
  statistics: z.object({
    total: z.object({
      clones: z.number(),
      duplicatedLines: z.number(),
      percentage: z.number(),
    }),
  }),
});

export function duplicateScope(
  target: string,
  packageNames: readonly string[],
) {
  if (target === 'web') return { sources: ['apps/web/src'], threshold: 0 };
  return {
    sources: [
      'apps/web/src',
      'apps/server/src',
      'apps/desktop/src',
      'apps/mobile/src',
      ...packageNames.map((name) => `packages/${name}/src`),
    ],
    threshold: 1,
  };
}

export function scanDuplicates(
  from: string,
  scope: { sources: readonly string[]; threshold: number },
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
    const report = reportSchema.parse(
      JSON.parse(readFileSync(join(scratch, 'jscpd-report.json'), 'utf8')),
    );
    return {
      ...report,
      exceeded: report.statistics.total.percentage > scope.threshold,
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
