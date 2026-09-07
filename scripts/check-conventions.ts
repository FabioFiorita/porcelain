import { execFileSync } from 'node:child_process';

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
).split('\0');
const invalid = files.filter((file) => /\.test\.[cm]?[jt]sx?$/.test(file));
if (invalid.length > 0) {
  console.error(`Use .spec.ts or .spec.tsx for tests:\n${invalid.join('\n')}`);
  process.exitCode = 1;
}
