import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mutableDeclarations } from './source-conventions.ts';

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

const indexModules = files.filter((file) =>
  /(^|\/)index\.(?:[cm]?[jt]sx?)$/i.test(file),
);
if (indexModules.length > 0) {
  console.error(
    `Use descriptive module filenames instead of index modules:\n${indexModules.join('\n')}`,
  );
  process.exitCode = 1;
}

const declarations = [...new Set(files)]
  .filter((file) => file && existsSync(file) && /\.[cm]?[jt]sx?$/.test(file))
  .flatMap((file) => mutableDeclarations(file, readFileSync(file, 'utf8')));
if (declarations.length > 0) {
  console.error(declarations.join('\n'));
  process.exitCode = 1;
}
