import { deepStrictEqual, strictEqual, match } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { domainPackages } from './policy.ts';
import { typeRuleFindings } from './type-rules.ts';
import { guardrailCases } from './rule-cases.mjs';

function nativeTypeFixture(source) {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-effect-types-'));
  const repository = fileURLToPath(new URL('../', import.meta.url));
  try {
    symlinkSync(
      join(repository, 'node_modules'),
      join(root, 'node_modules'),
      'dir',
    );
    writeFiles(root, {
      'package.json': '{"type":"module"}',
      'fixture.ts': Object.entries({
        __ADMISSION__: 'packages/effects/src/worktree-lease.ts',
      }).reduce(
        (text, [key, path]) => text.replaceAll(key, join(repository, path)),
        source,
      ),
      'tsconfig.json': JSON.stringify({
        extends: join(repository, 'tsconfig.json'),
        include: ['fixture.ts'],
      }),
    });
    const checked = spawnSync(
      join(repository, 'node_modules/.bin/tsc'),
      ['--pretty', 'false', '-p', join(root, 'tsconfig.json')],
      { encoding: 'utf8' },
    );
    if (checked.error) throw checked.error;
    const output = checked.stdout + checked.stderr;
    const errors = [
      ...output.matchAll(/fixture\.ts\(\d+,\d+\): error (TS\d+):/g),
    ].map((match) => match[1]);
    strictEqual(checked.status === 0, errors.length === 0, output);
    strictEqual(
      [...output.matchAll(/error TS\d+:/g)].length,
      errors.length,
      output,
    );
    return errors;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeFiles(root, files) {
  for (const [name, source] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
}

function typeFixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-type-rules-'));
  try {
    symlinkSync(
      fileURLToPath(new URL('../node_modules', import.meta.url)),
      join(root, 'node_modules'),
      'dir',
    );
    for (const name of [...domainPackages, 'kernel'])
      writeFiles(root, {
        [`packages/${name}/tsconfig.json`]: JSON.stringify({
          compilerOptions: {
            strict: true,
            target: 'esnext',
            module: 'nodenext',
            noEmit: true,
          },
          include: ['src/**/*.ts'],
        }),
        [`packages/${name}/src/errors/index.ts`]: 'export {};',
        [`packages/${name}/src/models/index.ts`]: 'export {};',
        [`packages/${name}/src/ports/index.ts`]: 'export {};',
      });
    writeFiles(root, {
      'apps/server/tsconfig.json': JSON.stringify({
        compilerOptions: {
          strict: true,
          target: 'esnext',
          module: 'nodenext',
          noEmit: true,
        },
        include: ['src/**/*.ts', '../../packages/*/src/**/*.ts'],
      }),
      ...files,
    });
    return typeRuleFindings(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export function runGuardrailCases(named = []) {
  const cases = guardrailCases.filter(
    (entry) => named.length === 0 || named.includes(entry.rule),
  );
  strictEqual(cases.length > 0, true, 'Name an existing ownership fixture.');
  for (const entry of cases) {
    if (entry.rule === 'worktree-capability-types') {
      deepStrictEqual(nativeTypeFixture(entry.valid), [], entry.rule);
      deepStrictEqual(
        nativeTypeFixture(entry.invalid),
        entry.errors,
        entry.rule,
      );
    } else {
      deepStrictEqual(
        typeFixture({ ...entry.files, ...entry.valid }),
        [],
        entry.rule,
      );
      deepStrictEqual(
        typeFixture({ ...entry.files, ...entry.invalid }).map(
          (finding) => finding.rule,
        ),
        entry.errors,
        entry.rule,
      );
    }
  }
  return cases.length;
}

export function runBoundaryCases() {
  const repository = fileURLToPath(new URL('../', import.meta.url));
  const cases = [
    {
      rule: 'domains-independent',
      from: 'packages/projects/src/rules/read.ts',
      valid: 'packages/projects/src/models/project.ts',
      invalid: 'packages/reviews/src/models/review.ts',
    },
    {
      rule: 'domains-no-wire-or-platform',
      from: 'packages/projects/src/services/nested/read.ts',
      valid: 'packages/projects/src/models/project.ts',
      invalid: 'packages/contracts/src/projects/inventory.ts',
    },
    {
      rule: 'domains-no-node-io',
      from: 'packages/projects/src/rules/read.ts',
      valid: 'node:crypto',
      invalid: 'node:fs',
    },
    {
      rule: 'crypto-rules-only',
      from: 'packages/projects/src/services/read.ts',
      valid: 'packages/projects/src/models/project.ts',
      invalid: 'node:crypto',
    },
    {
      rule: 'kernel-independent',
      from: 'packages/kernel/src/rules/read.ts',
      valid: 'packages/kernel/src/models/value.ts',
      invalid: 'packages/projects/src/models/project.ts',
    },
    {
      rule: 'kernel-no-node-io',
      from: 'packages/kernel/src/rules/read.ts',
      valid: 'node:crypto',
      invalid: 'node:fs',
    },
    {
      rule: 'domains-no-platform-libraries',
      from: 'packages/projects/src/services/read.ts',
      valid: 'effect',
      invalid: 'effect/http',
    },
    {
      rule: 'domains-no-platform-libraries',
      from: 'packages/projects/src/services/read.ts',
      valid: 'effect',
      invalid: 'effect/process',
    },
    {
      rule: 'domains-no-platform-libraries',
      from: 'packages/kernel/src/rules/read.ts',
      valid: 'effect',
      invalid: 'effect/FileSystem',
    },
    {
      rule: 'domains-no-platform-libraries',
      from: 'packages/kernel/src/rules/read.ts',
      valid: 'effect',
      invalid: '@effect/platform-node',
    },
    {
      rule: 'client-no-app-or-platform',
      from: 'packages/client/src/features/projects/queries/read.ts',
      valid: 'packages/client/src/features/projects/rules/project.ts',
      invalid: 'apps/server/src/use-cases/projects/read.ts',
    },
    {
      rule: 'client-no-platform-libraries',
      from: 'packages/client/src/shared/api/read.ts',
      valid: 'effect',
      invalid: '@effect/platform-node',
    },
    {
      rule: 'clients-no-node-io',
      from: 'packages/client/src/shared/api/read.ts',
      valid: 'effect',
      invalid: 'node:fs',
    },
    {
      rule: 'contracts-no-implementation',
      from: 'packages/contracts/src/projects/read.ts',
      valid: 'packages/contracts/src/shared/response.ts',
      invalid: 'packages/projects/src/services/read-service.ts',
    },
    {
      rule: 'contracts-no-implementation',
      from: 'packages/contracts/src/access/read.ts',
      valid: 'packages/access/src/models/index.ts',
      invalid: 'packages/access/src/services/index.ts',
    },
    {
      rule: 'contracts-no-node-io',
      from: 'packages/contracts/src/projects/read.ts',
      valid: 'effect',
      invalid: 'node:fs',
    },
    {
      rule: 'packages-use-public-imports',
      from: 'packages/storage/src/read.ts',
      valid: 'packages/kernel/src/models/value.ts',
      invalid: 'packages/kernel/src/models/private.ts',
    },
    {
      rule: 'apps-use-public-package-imports',
      from: 'apps/web/src/features/projects/views/read.ts',
      valid: 'packages/client/src/index.ts',
      invalid: 'packages/client/src/features/projects/store.ts',
    },
    {
      rule: 'apps-independent',
      from: 'apps/web/src/features/projects/views/read.ts',
      valid: 'apps/web/src/features/projects/views/title.ts',
      invalid: 'apps/mobile/src/features/projects/views/title.ts',
    },
    {
      rule: 'shared-imports-no-feature-owner',
      from: 'apps/web/src/shared/pure.ts',
      valid: 'apps/web/src/shared/other.ts',
      invalid: 'apps/web/src/features/projects/views/read.ts',
    },
    {
      rule: 'client-shared-imports-no-feature-owner',
      from: 'packages/client/src/shared/api/read.ts',
      valid: 'packages/client/src/shared/api/other.ts',
      invalid: 'packages/client/src/features/projects/store.ts',
    },
    {
      rule: 'web-routes-import-feature-index',
      from: 'apps/web/src/routes/read.ts',
      valid: 'apps/web/src/features/projects/index.ts',
      invalid: 'apps/web/src/features/projects/views/read.ts',
    },
    {
      rule: 'web-features-import-feature-index',
      from: 'apps/web/src/features/files/views/read.ts',
      valid: 'apps/web/src/features/projects/index.ts',
      invalid: 'apps/web/src/features/projects/views/read.ts',
    },
    {
      rule: 'mobile-routes-import-feature-index',
      from: 'apps/mobile/src/app/read.ts',
      valid: 'apps/mobile/src/features/projects/index.ts',
      invalid: 'apps/mobile/src/features/projects/views/read.ts',
    },
    {
      rule: 'mobile-features-import-feature-index',
      from: 'apps/mobile/src/features/files/views/read.ts',
      valid: 'apps/mobile/src/features/projects/index.ts',
      invalid: 'apps/mobile/src/features/projects/views/read.ts',
    },
  ];
  cases.push({
    rule: 'no-circular-source-imports',
    from: 'packages/kernel/src/rules/read.ts',
    valid: 'packages/kernel/src/rules/leaf.ts',
    invalid: 'packages/kernel/src/rules/cycle.ts',
  });
  for (const entry of cases) {
    for (const variant of ['valid', 'invalid']) {
      const root = mkdtempSync(join(tmpdir(), 'porcelain-boundary-'));
      try {
        writeFiles(root, {
          'tsconfig.json': JSON.stringify({ include: ['**/*.ts'] }),
          'packages/kernel/package.json': JSON.stringify({
            exports: { './value': './src/models/value.ts' },
          }),
          'packages/client/package.json': JSON.stringify({
            exports: { '.': './src/index.ts' },
          }),
          'packages/access/package.json': JSON.stringify({
            exports: {
              './models': './src/models/index.ts',
              './services': './src/services/index.ts',
            },
          }),
        });
        mkdirSync(join(root, 'node_modules/@effect'), { recursive: true });
        symlinkSync(
          join(repository, 'node_modules/effect'),
          join(root, 'node_modules/effect'),
          'dir',
        );
        symlinkSync(
          join(repository, 'apps/server/node_modules/@effect/platform-node'),
          join(root, 'node_modules/@effect/platform-node'),
          'dir',
        );
        const target = entry[variant];
        let specifier = target;
        if (
          !target.startsWith('node:') &&
          !target.startsWith('effect') &&
          !target.startsWith('@effect/')
        ) {
          const source =
            entry.rule === 'no-circular-source-imports' && variant === 'invalid'
              ? `import './read.ts'; export const value = 1;`
              : 'export const value = 1;';
          writeFiles(root, { [target]: source });
          specifier = relative(dirname(entry.from), target);
          if (!specifier.startsWith('.')) specifier = `./${specifier}`;
        }
        if (
          entry.rule === 'packages-use-public-imports' &&
          variant === 'valid'
        ) {
          mkdirSync(join(root, 'node_modules/@porcelain'), { recursive: true });
          symlinkSync(
            join(root, 'packages/kernel'),
            join(root, 'node_modules/@porcelain/kernel'),
            'dir',
          );
          specifier = '@porcelain/kernel/value';
        }
        if (target.startsWith('packages/access/src/')) {
          mkdirSync(join(root, 'node_modules/@porcelain'), { recursive: true });
          symlinkSync(
            join(root, 'packages/access'),
            join(root, 'node_modules/@porcelain/access'),
            'dir',
          );
          specifier = `@porcelain/access/${variant === 'valid' ? 'models' : 'services'}`;
        }
        writeFiles(root, {
          [entry.from]: `import * as owner from '${specifier}'; export const result = owner;`,
        });
        const run = spawnSync(
          join(repository, 'node_modules/.bin/depcruise'),
          [
            '--config',
            join(repository, 'architecture/dependency-cruiser.cjs'),
            '--output-type',
            'err',
            entry.from,
          ],
          { cwd: root, encoding: 'utf8' },
        );
        if (run.error) throw run.error;
        const output = run.stdout + run.stderr;
        strictEqual(run.signal, null, output);
        strictEqual(
          run.status === 0,
          variant === 'valid',
          `${entry.from}: ${specifier}\n${output}`,
        );
        if (variant === 'invalid') {
          match(output, new RegExp(entry.rule));
          if (target === 'effect/FileSystem')
            match(output, /node_modules\/effect\/(?:src|dist)\/FileSystem\./);
          if (target === '@effect/platform-node')
            match(output, /node_modules\/@effect\/platform-node\//);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  }
  return cases.length;
}
