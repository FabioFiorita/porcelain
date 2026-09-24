import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2];
if (mode !== 'lint' && mode !== 'format')
  throw new Error('Usage: node scripts/server-style.ts lint|format');

const packages = readdirSync('packages', { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      entry.name !== 'client' &&
      existsSync(join('packages', entry.name, 'src')),
  )
  .flatMap((entry) => [
    join('packages', entry.name, 'src'),
    join('packages', entry.name, 'spec'),
  ]);

const roots = [
  'apps/server/src',
  'apps/server/spec',
  ...packages,
  'packages/storage/scripts',
  'packages/storage/drizzle.config.ts',
  'architecture',
  'scripts',
  'vitest.config.ts',
  '.agents/skills/server-verify/scripts',
  '.agents/skills/server-verify/feature-map',
].filter((root) => existsSync(root));

const disableDirective = /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable|enable)/;

function sourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory())
      return entry.name === 'node_modules' ? [] : sourceFiles(child);
    return /\.[cm]?[jt]s$/.test(entry.name) ? [child] : [];
  });
}

function disableDirectives(): string[] {
  return roots.flatMap(sourceFiles).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        disableDirective.test(line) ? [`${file}:${index + 1}`] : [],
      ),
  );
}

const executable = join(
  'node_modules',
  '.bin',
  mode === 'lint' ? 'oxlint' : 'oxfmt',
);
const options =
  mode === 'lint'
    ? [
        '--type-aware',
        '--report-unused-disable-directives',
        '--max-warnings',
        '0',
      ]
    : ['--check'];
const result = spawnSync(executable, [...options, ...roots], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
if (mode === 'lint') {
  const directives = disableDirectives();
  for (const location of directives)
    process.stderr.write(
      `${location}: fix the code instead of disabling a rule; disable directives are not allowed.\n`,
    );
  if (directives.length > 0) process.exitCode = 1;
}
