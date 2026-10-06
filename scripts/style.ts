import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pinProblems, uiFolder } from '../architecture/shadcn-pins.ts';

const [mode, target] = process.argv.slice(2);
if (
  (mode !== 'lint' && mode !== 'format') ||
  (target !== 'server' && target !== 'web')
)
  throw new Error('Usage: node scripts/style.ts lint|format server|web');

const packages = readdirSync('packages', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => [
    join('packages', entry.name, 'src'),
    join('packages', entry.name, 'spec'),
  ]);
const roots = (
  target === 'web'
    ? [
        'apps/web/src',
        'apps/web/spec',
        'apps/web/vite.config.ts',
        'apps/web/vitest.config.ts',
        'apps/web/playwright.config.ts',
      ]
    : [
        'apps/mobile/src',
        'apps/mobile/spec',
        'apps/mobile/app.config.ts',
        'apps/mobile/metro.config.cjs',
        'apps/desktop/src',
        'apps/desktop/spec',
        'apps/desktop/playwright.config.ts',
        'apps/server/src',
        'apps/server/spec',
        ...packages,
        'packages/storage/scripts',
        'architecture',
        'scripts',
        'vitest.config.ts',
        ...['server', 'web', 'desktop', 'mobile'].map(
          (surface) => `.agents/skills/${surface}-verify/scripts`,
        ),
        '.agents/skills/verify-core',
      ]
).filter((root) => existsSync(root));
const generated = new Set([
  'apps/web/src/routeTree.gen.ts',
  'apps/mobile/src/config/uniwind-types.d.ts',
]);
const ignoredFolders = new Set(['node_modules', 'dist', '.turbo', '.vite']);

function sourceFiles(path: string): string[] {
  if (/\.[cm]?[jt]sx?$/.test(path)) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const file = join(path, entry.name);
    return entry.isDirectory()
      ? ignoredFolders.has(entry.name)
        ? []
        : sourceFiles(file)
      : /\.[cm]?[jt]sx?$/.test(file)
        ? [file]
        : [];
  });
}

const files = roots
  .flatMap(sourceFiles)
  .filter((file) => !generated.has(file) && !file.startsWith(`${uiFolder}/`));
const command = mode === 'format' ? 'oxfmt' : 'oxlint';
const arguments_ =
  mode === 'format'
    ? ['--check', ...roots, ...[...generated].map((path) => `!${path}`)]
    : [
        '--config',
        '.oxlintrc.json',
        '--no-ignore',
        '--type-aware',
        '--report-unused-disable-directives',
        ...files,
      ];
const result = spawnSync(join('node_modules', '.bin', command), arguments_, {
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

if (mode === 'lint' && target === 'web') {
  const problems = pinProblems('.');
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  if (problems.length > 0) process.exitCode = 1;
}
