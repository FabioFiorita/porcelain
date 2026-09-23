import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
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
  .map((entry) => join('packages', entry.name, 'src'));

const roots = [
  'apps/server/src',
  ...packages,
  ...(mode === 'lint'
    ? ['architecture/policy.ts', 'architecture/policy.spec.ts']
    : ['architecture']),
  'scripts',
  '.agents/skills/server-verify/scripts',
];
const executable = join(
  'node_modules',
  '.bin',
  mode === 'lint' ? 'oxlint' : 'oxfmt',
);
const options =
  mode === 'lint' ? ['--type-aware', '--max-warnings', '0'] : ['--check'];
const result = spawnSync(executable, [...options, ...roots], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
