import { deepStrictEqual, ok } from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cruise } from 'dependency-cruiser';
import extractDepcruiseOptions from 'dependency-cruiser/config-utl/extract-depcruise-options';
import cases from './boundary-cases.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const config = createRequire(import.meta.url)('./dependency-cruiser.cjs');
async function planted(files) {
  const previous = process.cwd();
  const root = mkdtempSync(join(tmpdir(), 'porcelain-boundary-'));
  try {
    mkdirSync(join(root, 'node_modules/@effect'), { recursive: true });
    mkdirSync(join(root, 'node_modules/@porcelain'), { recursive: true });
    symlinkSync(
      join(repository, 'node_modules/effect'),
      join(root, 'node_modules/effect'),
      'dir',
    );
    symlinkSync(
      join(repository, 'node_modules/@effect/platform-node'),
      join(root, 'node_modules/@effect/platform-node'),
      'dir',
    );
    symlinkSync(
      join(root, 'packages/process'),
      join(root, 'node_modules/@porcelain/process'),
      'dir',
    );
    const fixtureConfig = {
      ...config,
      options: { ...config.options, tsConfig: { fileName: 'tsconfig.json' } },
    };
    writeFileSync(
      join(root, 'dependency-cruiser.cjs'),
      `module.exports = ${JSON.stringify(fixtureConfig)};`,
    );
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { module: 'nodenext', moduleResolution: 'nodenext' },
      }),
    );
    for (const [file, source] of Object.entries({
      'packages/process/src/index.ts': 'export const value = 1;',
      'packages/process/package.json': JSON.stringify({
        name: '@porcelain/process',
        exports: './src/index.ts',
      }),
      ...files,
    })) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), source);
    }
    process.chdir(root);
    const result = await cruise(Object.keys(files), {
      ...(await extractDepcruiseOptions(join(root, 'dependency-cruiser.cjs'))),
      outputType: 'err',
    });
    ok(typeof result.output === 'string');
    const violations = [...result.output.matchAll(/error ([a-z-]+):/g)].map(
      (match) => match[1],
    );
    deepStrictEqual(
      result.exitCode === 0,
      violations.length === 0,
      result.output,
    );
    return violations;
  } finally {
    process.chdir(previous);
    rmSync(root, { recursive: true, force: true });
  }
}
export async function runBoundaryCases() {
  for (const entry of cases) {
    deepStrictEqual(await planted(entry.valid), [], `${entry.rule}: valid`);
    const violations = await planted(entry.invalid);
    ok(
      violations.includes(entry.rule),
      `${entry.rule}: invalid produced ${violations.join(', ')}`,
    );
    process.stdout.write(
      `PASS ${entry.rule}: valid accepted; planted violation rejected\n`,
    );
  }
  const covered = new Set(cases.map((entry) => entry.rule));
  deepStrictEqual(
    config.forbidden
      .filter((entry) => !covered.has(entry.name))
      .map((entry) => entry.name),
    [],
    'Every graph guarantee has a valid and invalid planted fixture.',
  );
  process.stdout.write(
    `PASS ${cases.length} boundary fixture pairs; temporary files removed\n`,
  );
}
