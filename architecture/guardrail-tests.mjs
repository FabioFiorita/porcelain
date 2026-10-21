import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  globSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { domainPackages } from './policy.ts';
import { typeRuleFindings } from './type-rules.ts';
import { duplicateScope, scanDuplicates } from './duplicate-policy.ts';
import { selectorAppears } from './feature-selectors.ts';
import { guardrailCases } from './rule-cases.mjs';
import { handlerCoverage } from '../apps/server/spec/kit/route-coverage.ts';
import { featureMapProblems } from '../scripts/feature-maps.ts';
import knip from './knip.ts';
import { reactCompilerProblems } from '../scripts/react-compiler.ts';

function fixtureRoot(prefix) {
  return realpathSync(mkdtempSync(join(tmpdir(), prefix)));
}

function nativeTypeFixture(source) {
  const root = fixtureRoot('porcelain-effect-types-');
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
  const root = fixtureRoot('porcelain-type-rules-');
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
  const root = fixtureRoot('porcelain-feature-maps-');
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
  const root = fixtureRoot('porcelain-clone-rule-');
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

function ciSelectionFixture(entry) {
  const root = fixtureRoot('porcelain-ci-selection-');
  const repository = fileURLToPath(new URL('../', import.meta.url));
  const run = (command, args, env = {}) => {
    const result = spawnSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    if (result.error) throw result.error;
    strictEqual(result.status, 0, result.stdout + result.stderr);
    return result.stdout;
  };
  try {
    const manifests = globSync(
      [
        'apps/*/package.json',
        'packages/*/package.json',
        '.agents/skills/package.json',
      ],
      { cwd: repository },
    );
    for (const path of [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'turbo.json',
      '.github/workflows/ci.yml',
      ...manifests,
    ])
      writeFiles(root, {
        [path]: readFileSync(join(repository, path), 'utf8'),
      });
    for (const fixture of entry.cases)
      if (fixture.source) writeFiles(root, { [fixture.path]: fixture.source });
    run('git', ['init', '--quiet']);
    run('git', ['add', '.']);
    run('git', [
      '-c',
      'user.name=CI fixture',
      '-c',
      'user.email=ci-fixture@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--quiet',
      '-m',
      'Create CI selection fixture',
    ]);
    for (const fixture of entry.cases) {
      const path = fixture.path && join(root, fixture.path);
      const original = path && readFileSync(path, 'utf8');
      if (path) writeFileSync(path, original + '\n');
      const dry = JSON.parse(
        run(
          join(repository, 'node_modules/.bin/turbo'),
          [
            'run',
            'test:integration',
            'test:e2e',
            'build',
            'build:package',
            'db:check',
            '--affected',
            '--dry=json',
          ],
          { TURBO_SCM_BASE: 'HEAD', TURBO_SCM_HEAD: 'HEAD' },
        ),
      );
      const tasks = new Set(dry.tasks.map((task) => task.taskId));
      const selected = [
        [
          'server',
          [
            '@porcelain/server#test:integration',
            '@porcelain/client#test:integration',
            '@porcelain/verification#test:integration',
          ],
        ],
        ['web-integration', ['@porcelain/web#test:integration']],
        ['web-e2e', ['@porcelain/web#test:e2e']],
        ['desktop', ['@porcelain/desktop#test:e2e']],
        ['storage', ['@porcelain/storage#db:check']],
        ['package', ['//#build:package']],
      ]
        .filter(([, ids]) => ids.some((id) => tasks.has(id)))
        .map(([gate]) => gate);
      deepStrictEqual(selected, fixture.selected, fixture.name);
      if (path) writeFileSync(path, original);
      process.stdout.write(`PASS ci-affected-selection: ${fixture.name}\n`);
    }
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
    if (entry.rule === 'ci-affected-selection') {
      ciSelectionFixture(entry);
    } else if (entry.rule === 'ci-required-checks') {
      const workflow = parse(
        readFileSync(
          new URL('../.github/workflows/ci.yml', import.meta.url),
          'utf8',
        ),
      );
      const gate = workflow.jobs.checks;
      deepStrictEqual(
        gate.needs.toSorted(),
        Object.keys(entry.needs).toSorted(),
      );
      strictEqual(gate.if, '${{ always() }}');
      strictEqual(gate.steps[0].env.NEEDS, '${{ toJSON(needs) }}');
      for (const [job, output] of entry.optional)
        strictEqual(
          workflow.jobs[job].if,
          `\${{ needs.affected.outputs.${output} == 'true' }}`,
          job,
        );
      for (const fixture of entry.cases) {
        const needs = structuredClone(entry.needs);
        for (const [job, result] of Object.entries(fixture.results ?? {}))
          needs[job].result = result;
        Object.assign(needs.affected.outputs, fixture.outputs);
        for (const job of fixture.missingJobs ?? []) delete needs[job];
        for (const job of fixture.missingResults ?? [])
          delete needs[job].result;
        for (const output of fixture.missingOutputs ?? [])
          delete needs.affected.outputs[output];
        const checked = spawnSync(
          'bash',
          ['-e', '-o', 'pipefail', '-c', gate.steps[0].run],
          {
            encoding: 'utf8',
            env: {
              ...process.env,
              NEEDS: fixture.raw ?? JSON.stringify(needs),
            },
          },
        );
        if (checked.error) throw checked.error;
        strictEqual(
          checked.status,
          fixture.status,
          `${fixture.name}: ${checked.stdout}${checked.stderr}`,
        );
        process.stdout.write(`PASS ci-required-checks: ${fixture.name}\n`);
      }
    } else if (entry.rule === 'server-handler-coverage') {
      strictEqual(handlerCoverage(entry.completeLogs), undefined);
      throws(
        () => handlerCoverage(entry.missingToolLogs),
        (error) =>
          error instanceof Error && error.message.startsWith(entry.error),
      );
    } else if (entry.rule === 'mobile-react-compiler') {
      deepStrictEqual(reactCompilerProblems(entry.path, entry.valid), []);
      const invalid = reactCompilerProblems(entry.path, entry.invalid);
      strictEqual(invalid.length, 1);
      for (const expected of entry.errors)
        strictEqual(invalid[0].includes(expected), true, invalid[0]);
    } else if (entry.rule === 'knip-expo-destination-anchor') {
      knip.compilers.tsx(entry.valid, entry.path);
      throws(
        () => knip.compilers.tsx(entry.invalid, entry.path),
        /cold deep link needs a route to go back to/,
      );
    } else if (entry.rule === 'knip-expo-framework-exports') {
      strictEqual(knip.compilers.tsx(entry.source, entry.path), entry.expected);
    } else if (['eqeqeq', 'no-nested-ternary'].includes(entry.rule)) {
      const root = fixtureRoot('porcelain-equality-');
      try {
        const repository = fileURLToPath(new URL('../', import.meta.url));
        symlinkSync(
          join(repository, 'node_modules'),
          join(root, 'node_modules'),
          'dir',
        );
        for (const [source, errors] of [
          [entry.valid, []],
          [entry.invalid, entry.errors],
        ]) {
          writeFiles(root, { [entry.path ?? 'fixture.ts']: source });
          const checked = spawnSync(
            join(repository, 'node_modules/.bin/oxlint'),
            [
              '--config',
              join(repository, '.oxlintrc.json'),
              '--format',
              'json',
              join(root, entry.path ?? 'fixture.ts'),
            ],
            { encoding: 'utf8', cwd: root },
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
    name: 'client',
    sources: ['apps/web/src', 'apps/mobile/src', 'packages/client/src'],
    metric: 'clones',
    ceiling: 0,
    why: 'Keep shared client logic and specs in one owner so fixes cannot drift between apps.',
  });
  process.stdout.write(`PASS ${cases.length} guardrail fixtures\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  runGuardrailCases(process.argv.slice(2));
