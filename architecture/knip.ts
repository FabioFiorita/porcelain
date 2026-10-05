import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KnipConfiguration } from 'knip';
import { parseSync } from 'oxc-parser';
import { z } from 'zod';
import { generatedRouteTree, type ArchRule } from './policy.ts';

const items = z.array(z.object({ name: z.string() })).optional();
const reportSchema = z.object({
  issues: z.array(
    z.object({
      file: z.string(),
      files: items,
      exports: items,
      types: items,
      nsExports: items,
      nsTypes: items,
      dependencies: items,
    }),
  ),
});
const source =
  /^(?:apps\/(?:server|desktop|web|mobile)|packages\/[^/]+)\/src\/.+\.tsx?$/;
const skipped = /(?:\.spec|\.d)\.ts$|^apps\/web\/src\/components\/ui\//;

export function knipFindings(root: string) {
  const checked = spawnSync(
    join(root, 'node_modules/.bin/knip'),
    [
      '--config',
      fileURLToPath(import.meta.url),
      '--no-progress',
      '--reporter',
      'json',
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (checked.error) throw checked.error;
  if (checked.status !== 0 && checked.status !== 1)
    throw new Error(`Knip could not check unused code: ${checked.stderr}`);
  const report = reportSchema.parse(JSON.parse(checked.stdout));
  const findings: { rule: ArchRule; from: string; to: string }[] = [];
  for (const issue of report.issues) {
    if (
      source.test(issue.file) &&
      !skipped.test(issue.file) &&
      issue.file !== generatedRouteTree
    )
      for (const kind of [
        'files',
        'exports',
        'types',
        'nsExports',
        'nsTypes',
      ] as const)
        for (const item of issue[kind] ?? [])
          findings.push({
            rule: 'unused-export',
            from: issue.file,
            to: `${item.name}: delete the unused declaration or stop exporting it, because no entry point uses it`,
          });
    if (issue.file === 'apps/web/package.json')
      for (const item of issue.dependencies ?? [])
        findings.push({
          rule: 'unused-dependency',
          from: issue.file,
          to: `${item.name}: remove the dependency, because no web module or stylesheet uses it`,
        });
  }
  return findings;
}

function expoEntries(source: string, path: string): string {
  if (!/\/apps\/mobile\/src\/app\/.+\.tsx$/.test(path)) return source;
  const parsed = parseSync(path, source, { lang: 'tsx' });
  if (parsed.errors.length) throw new Error(`Knip could not parse ${path}`);
  const entries = parsed.program.body.filter(
    (node) =>
      node.type === 'ExportDefaultDeclaration' ||
      (node.type === 'ExportNamedDeclaration' &&
        node.specifiers.length === 1 &&
        node.specifiers[0]?.exported.type === 'Identifier' &&
        node.specifiers[0].exported.name === 'default'),
  );
  for (const node of entries.toReversed())
    source =
      source.slice(0, node.start) +
      '/** @public */\n' +
      source.slice(node.start);
  return source;
}

export default {
  include: [
    'files',
    'exports',
    'types',
    'nsExports',
    'nsTypes',
    'dependencies',
  ],
  includeEntryExports: true,
  workspaces: {
    '.': {
      entry: [
        'scripts/*.ts',
        'scripts/cli/**/*.ts',
        'architecture/rule-tests.mjs',
        'architecture/guardrail-tests.mjs',
      ],
      project: ['scripts/**/*.ts', 'architecture/**/*.{ts,mjs}'],
      includeEntryExports: false,
    },
    'apps/desktop': {
      entry: [
        'src/{main,preload,server}.ts',
        'src/**/*.spec.ts',
        'spec/**/*.e2e.ts',
      ],
      project: ['src/**/*.ts', 'spec/**/*.ts'],
    },
    'apps/server': {
      entry: [
        'src/bootstrap/main.ts',
        'src/**/*.spec.ts',
        'spec/**/*.{spec,integration,perf}.ts',
      ],
      project: ['src/**/*.ts', 'spec/**/*.ts'],
    },
    'apps/web': {
      entry: [
        'src/main.tsx',
        'src/**/*.spec.ts',
        'spec/**/*.{test,e2e}.tsx',
        'spec/**/*.e2e.ts',
      ],
      project: ['src/**/*.{ts,tsx,css}', 'spec/**/*.{ts,tsx}'],
      ignoreIssues: {
        'src/components/ui/**': ['exports', 'types', 'nsExports', 'nsTypes'],
      },
    },
    'apps/mobile': {
      entry: [
        'src/app/**/*.tsx',
        'src/**/*.spec.ts',
        'spec/**/*.e2e.ts',
        'metro.config.cjs',
      ],
      project: ['src/**/*.{ts,tsx,css}', 'spec/**/*.ts'],
      tailwind: true,
      metro: { config: [] },
    },
    'packages/*': {
      entry: [
        'src/**/*.spec.ts',
        'spec/**/*.{spec,integration}.ts',
        'spec/fixtures/isolated-git.ts',
      ],
      project: ['src/**/*.ts', 'spec/**/*.ts'],
    },
  },
  compilers: { tsx: expoEntries },
} satisfies KnipConfiguration;
