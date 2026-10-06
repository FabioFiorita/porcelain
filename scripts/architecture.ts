import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cruise } from 'dependency-cruiser';
import extractDepcruiseOptions from 'dependency-cruiser/config-utl/extract-depcruise-options';
import { typeRuleFindings } from '../architecture/type-rules.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function nativeTool(name: string, args: string[]): boolean {
  const result = spawnSync(join(root, 'node_modules/.bin', name), args, {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.signal || result.status === null)
    throw new Error(
      `${name} did not complete (${result.signal ?? 'no exit status'})`,
    );
  return result.status === 0;
}

try {
  if (
    process.argv[2] !== 'check' ||
    process.argv.slice(3).some((arg) => arg !== '--all')
  )
    throw new Error('Usage: node scripts/architecture.ts check [--all]');
  const sources = [
    ...['apps', 'packages'].flatMap((folder) =>
      readdirSync(join(root, folder), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) =>
          ['src', 'spec'].map((part) => `${folder}/${entry.name}/${part}`),
        ),
    ),
  ].filter((path) => existsSync(join(root, path)));
  const report = await cruise(
    sources,
    {
      ...(await extractDepcruiseOptions(
        join(root, 'architecture/dependency-cruiser.cjs'),
      )),
      outputType: 'err',
    },
    { alias: { '@': join(root, 'apps/web/src') } },
  );
  if (typeof report.output !== 'string')
    throw new Error('Dependency reporter did not return text');
  process.stdout.write(report.output);
  let passed = report.exitCode === 0;
  const findings = typeRuleFindings(root);
  for (const finding of findings)
    process.stderr.write(`${finding.rule}: ${finding.from} -> ${finding.to}\n`);
  if (findings.length) passed = false;
  if (
    !nativeTool('knip', ['--config', 'architecture/knip.ts', '--no-progress'])
  )
    passed = false;
  if (!passed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
