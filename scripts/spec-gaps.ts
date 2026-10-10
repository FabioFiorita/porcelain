import { Schema } from 'effect';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  unspecifiedExports,
  specGapProblems,
} from '../architecture/spec-gaps.mjs';

const ruleFile =
  /^(?:packages\/[^/]+\/|apps\/[^/]+\/src\/).*\/rules\/[^/]+\.ts$/;
const eligible = (path: string) =>
  ruleFile.test(path) && !path.endsWith('.spec.ts');
function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory())
      return [
        'node_modules',
        'dist',
        'ios',
        'android',
        '.expo',
        '.turbo',
      ].includes(entry.name)
        ? []
        : files(path);
    return eligible(path) ? [path] : [];
  });
}
function gaps(
  paths: string[],
  read: (path: string) => string | undefined,
): string[] {
  return paths
    .flatMap((path) =>
      unspecifiedExports(
        path,
        read(path) ?? '',
        read(path.replace(/\.ts$/, '.spec.ts')),
      ).map((name: string) => `${path}#${name}`),
    )
    .sort();
}
const current = gaps([...files('packages'), ...files('apps')], (path) =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined,
);
if (process.argv.includes('--list')) {
  process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
} else {
  const baselinePath = 'architecture/spec-gaps-baseline.json';
  const decodeBaseline = Schema.decodeUnknownSync(Schema.Array(Schema.String));
  const baseline = decodeBaseline(
    JSON.parse(readFileSync(baselinePath, 'utf8')),
  );
  const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], {
    encoding: 'utf8',
  }).trim();
  const baseFiles = execFileSync(
    'git',
    ['ls-tree', '-r', '--name-only', base],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n');
  const readBase = (path: string) =>
    baseFiles.includes(path)
      ? execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' })
      : undefined;
  const previous = readBase(baselinePath);
  const allowed =
    previous === undefined
      ? gaps(baseFiles.filter(eligible), readBase)
      : decodeBaseline(JSON.parse(previous));
  const failures = specGapProblems(current, baseline, allowed);
  if (failures.length) {
    process.stderr.write(
      `${failures.join('\n')}\nCall every rule export in its sibling spec, because an unspecified decision is either dead or unpromised.\n`,
    );
    process.exitCode = 1;
  } else
    process.stdout.write(
      `Rule exports checked; ${baseline.length} existing gaps ratcheted.\n`,
    );
}
