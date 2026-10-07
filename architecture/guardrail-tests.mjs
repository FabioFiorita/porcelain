import { deepStrictEqual, strictEqual } from 'node:assert/strict';
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
import { duplicateScope, scanDuplicates } from './duplicate-policy.ts';
import { selectorAppears } from './feature-selectors.ts';
import { guardrailCases } from './rule-cases.mjs';
import { featureMapProblems } from '../scripts/feature-maps.ts';

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
        __LANES__: 'apps/server/src/runtime/lanes.ts',
        __REVIEW_SERVICES__: 'packages/reviews/src/services/index.ts',
        __REVIEW_MODELS__: 'packages/reviews/src/models/index.ts',
        __CLIENT_ACCESS__: 'packages/client/src/features/access/store.ts',
        __CLIENT_SESSION__:
          'packages/client/src/features/access/store/session.ts',
        __CLIENT_FACTORY__:
          'packages/client/src/features/access/ports/connection-factory.ts',
        __CLIENT_REMOTE_CONNECTIONS__:
          'packages/client/src/features/access/store/remote-connections.ts',
        __CLIENT_SELECTION__: 'packages/client/src/features/projects/store.ts',
        __CLIENT_QUEUES__: 'packages/client/src/shared/api/write-queue.ts',
        __CLIENT_OPERATIONS__:
          'packages/client/src/features/git-actions/ports/operation-store.ts',
        __CLIENT_OPERATION_LAYER__:
          'packages/client/src/features/git-actions/store/operations.ts',
        __PROCESS_COMMAND__: 'packages/process/src/commands/run-command.ts',
        __COMMIT_PLANNING__: 'packages/agents/src/commit-planning/index.ts',
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
        compilerOptions: { target: 'esnext', module: 'nodenext', noEmit: true },
        include: ['src/**/*.ts', '../../packages/*/src/**/*.ts'],
      }),
      'apps/server/src/http/status-policy.ts': 'export const rules = [];',
      'packages/storage/src/index.ts': 'export {};',
      ...files,
    });
    return typeRuleFindings(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function featureMapFixture(entry, files) {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-feature-maps-'));
  try {
    writeFiles(root, { ...entry.files, ...files });
    for (const file of files === entry.invalid ? (entry.remove ?? []) : [])
      rmSync(join(root, file), { recursive: true });
    return featureMapProblems(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function duplicateFixture(entry, source) {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-clone-rule-'));
  try {
    const scope = {
      ...duplicateScope(),
      ceiling: 0,
    };
    for (const folder of scope.sources)
      mkdirSync(join(root, folder), { recursive: true });
    writeFiles(root, { [entry.first]: source, [entry.second]: source });
    const report = scanDuplicates(root, scope);
    return {
      rejected: report.exceeded,
      pairs: report.duplicates.map((clone) =>
        [
          relative(root, clone.firstFile.name),
          relative(root, clone.secondFile.name),
        ].toSorted((left, right) => left.localeCompare(right)),
      ),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export function runGuardrailCases(named = []) {
  const cases = guardrailCases.filter(
    (entry) => named.length === 0 || named.includes(entry.rule),
  );
  strictEqual(
    cases.length > 0,
    true,
    'Name an existing guardrail fixture rule.',
  );
  for (const entry of cases) {
    if (entry.rule === 'eqeqeq') {
      const root = mkdtempSync(join(tmpdir(), 'porcelain-equality-'));
      try {
        const repository = fileURLToPath(new URL('../', import.meta.url));
        for (const [source, errors] of [
          [entry.valid, []],
          [entry.invalid, entry.errors],
        ]) {
          writeFiles(root, { 'fixture.ts': source });
          const checked = spawnSync(
            join(repository, 'node_modules/.bin/oxlint'),
            [
              '--config',
              join(repository, '.oxlintrc.json'),
              '--format',
              'json',
              join(root, 'fixture.ts'),
            ],
            { encoding: 'utf8' },
          );
          if (checked.error) throw checked.error;
          const diagnostics = JSON.parse(checked.stdout).diagnostics;
          deepStrictEqual(
            diagnostics.map((diagnostic) => diagnostic.code),
            errors,
            checked.stdout + checked.stderr,
          );
          strictEqual(checked.status, errors.length === 0 ? 0 : 1);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    } else if (
      [
        'worktree-capability-types',
        'native-transport-types',
        'native-client-state-types',
        'native-process-types',
        'native-agent-types',
        'native-effect-diagnostics',
        'review-draft-types',
        'worktree-transaction-types',
      ].includes(entry.rule)
    ) {
      deepStrictEqual(nativeTypeFixture(entry.valid), [], entry.rule);
      deepStrictEqual(
        nativeTypeFixture(entry.invalid),
        entry.errors,
        entry.rule,
      );
    } else if (entry.rule.startsWith('feature-map-')) {
      deepStrictEqual(featureMapFixture(entry, entry.valid), [], entry.rule);
      const invalid = featureMapFixture(entry, entry.invalid);
      strictEqual(invalid.length, entry.errors.length, entry.rule);
      for (const [index, expected] of entry.errors.entries())
        strictEqual(
          invalid[index].includes(expected),
          true,
          `${entry.rule}: ${invalid[index]}`,
        );
    } else if (entry.rule === 'feature-selector') {
      strictEqual(
        selectorAppears(entry.valid, entry.selector),
        true,
        entry.selector,
      );
      strictEqual(
        selectorAppears(entry.invalid, entry.selector),
        false,
        entry.selector,
      );
    } else if (entry.rule === 'duplicate-code') {
      deepStrictEqual(duplicateFixture(entry, entry.valid), {
        rejected: false,
        pairs: [],
      });
      deepStrictEqual(duplicateFixture(entry, entry.invalid), {
        rejected: true,
        pairs: [
          [entry.first, entry.second].toSorted((left, right) =>
            left.localeCompare(right),
          ),
        ],
      });
    } else {
      deepStrictEqual(
        typeFixture({ ...entry.files, ...entry.valid }),
        [],
        entry.rule,
      );
      const invalid = typeFixture({ ...entry.files, ...entry.invalid });
      deepStrictEqual(
        invalid.map((finding) => finding.rule),
        entry.errors,
        entry.rule,
      );
    }
  }
  deepStrictEqual(duplicateScope(), {
    name: 'web',
    sources: ['apps/web/src'],
    metric: 'clones',
    ceiling: 0,
    why: 'Keep web logic in one owner so fixes cannot drift between copies.',
  });
  process.stdout.write(`PASS ${cases.length} guardrail fixtures\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  runGuardrailCases(process.argv.slice(2));
