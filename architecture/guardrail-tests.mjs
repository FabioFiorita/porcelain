import {
  deepStrictEqual,
  doesNotMatch,
  match,
  strictEqual,
  throws,
} from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  chmodSync,
  globSync,
  existsSync,
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
import { Effect } from 'effect';
import { Statement } from 'effect/sql';
import { cruise } from 'dependency-cruiser';
import extractDepcruiseOptions from 'dependency-cruiser/config-utl/extract-depcruise-options';
import { checkPlan, nodeTaskInputs } from '../ci/check-plan.ts';
import { runtimePlan } from '../ci/runtime-plan.ts';
import { domainPackages } from './policy.ts';
import { typeRuleFindings } from './type-rules.ts';
import {
  clonesChangedSince,
  duplicateComparison,
  duplicateScope,
  raisedDuplicateCeiling,
  scanDuplicates,
  serverDuplicateScope,
  toolingDuplicateScope,
} from './duplicate-policy.ts';
import { selectorAppears } from './feature-selectors.ts';
import { guardrailCases } from './rule-cases.mjs';
import { checkStyle } from '../scripts/style.ts';
import { handlerCoverage } from '../apps/server/spec/kit/route-coverage.ts';
import { featureMapProblems } from '../scripts/feature-maps.ts';
import knip from './knip.ts';
import config from '../vite.config.ts';
import { reactCompilerProblems } from '../scripts/react-compiler.ts';
import { nativeMigrationHistoryProblems } from '../packages/storage/scripts/native-migration-history.ts';
import { withMigratedDatabase } from '../packages/storage/spec/kit/native-database.ts';
import { prepareRepositoryQueries } from '../packages/storage/spec/kit/repository-queries.ts';
import { repositoryQueries } from './repository-queries.ts';

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

function repositoryQueryFixture(source) {
  const root = fixtureRoot('porcelain-repository-sql-');
  try {
    symlinkSync(
      fileURLToPath(new URL('../node_modules', import.meta.url)),
      join(root, 'node_modules'),
      'dir',
    );
    writeFiles(root, {
      'package.json': '{"type":"module"}',
      'packages/storage/tsconfig.json': JSON.stringify({
        compilerOptions: {
          strict: true,
          module: 'nodenext',
          skipLibCheck: true,
        },
        include: ['src/repositories/**/*.ts'],
      }),
      'packages/storage/src/repositories/fixture.ts': [
        'import type { SqlClient, Statement } from "effect/sql";',
        'declare const sql: SqlClient.SqlClient;',
        'declare const fragment: Statement.Fragment, identifier: Statement.Identifier;',
        source,
      ].join('\n'),
    });
    const sql = Statement.make(
      Effect.die('The SQL fixture only compiles statements'),
      Statement.makeCompilerSqlite(),
      [],
      undefined,
    );
    return repositoryQueries(root, sql).map(({ text }) => text);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function checkMigratedRepositoryQueries() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  await withMigratedDatabase((database, sql) => {
    const queries = repositoryQueries(root, sql);
    strictEqual(
      queries.length > 0,
      true,
      'The guard must find repository queries',
    );
    const problems = prepareRepositoryQueries(database, queries);
    deepStrictEqual(problems, [], problems.join('\n\n'));
    process.stdout.write(
      `PASS repository-sql: prepared ${queries.length} queries against migrated SQLite\n`,
    );
  });
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
    writeFiles(root, { [entry.first]: source, [entry.second]: source });
    const scopes = {
      server: serverDuplicateScope,
      client: duplicateScope,
      tooling: toolingDuplicateScope,
    };
    const scope = { ...scopes[entry.scope ?? 'client'](root), ceiling: 0 };
    for (const folder of scope.sources)
      mkdirSync(join(root, folder), { recursive: true });
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

function requireSelectedInputs(paths, select, setting) {
  const omitted = paths.filter((path) => !select(path));
  deepStrictEqual(omitted, [], `Add these paths to the ${setting} input list`);
}

async function checkCiInputs(entry) {
  const repository = fileURLToPath(new URL('../', import.meta.url));
  const manifest = JSON.parse(
    readFileSync(join(repository, 'package.json'), 'utf8'),
  );
  const options = await extractDepcruiseOptions(
    join(repository, 'architecture/dependency-cruiser.cjs'),
  );
  const trace = async (command, owner) => {
    match(command, /^node \S+$/, `${owner} declares a single Node entry file`);
    const path = command.slice('node '.length);
    const { output } = await cruise([path], options);
    const modules = output.modules.filter(
      ({ source, coreModule }) =>
        !coreModule && !source.split('/').includes('node_modules'),
    );
    const unresolved = modules
      .flatMap(({ dependencies }) => dependencies)
      .filter(
        ({ couldNotResolve, module }) =>
          couldNotResolve && /^(?:\.|@porcelain\/)/.test(module),
      );
    deepStrictEqual(
      unresolved.map(({ module }) => module),
      [],
      `${owner} has unresolved repository imports`,
    );
    const paths = modules
      .filter(({ couldNotResolve }) => !couldNotResolve)
      .map(({ source }) => source);
    for (const expected of [path, ...(entry.requiredImports[owner] ?? [])])
      strictEqual(
        paths.includes(expected),
        true,
        `Trace of ${owner} must include ${expected}; check dependency-cruiser exclusions`,
      );
    return paths;
  };

  for (const task of Object.keys(nodeTaskInputs)) {
    const selectsTask = (path) =>
      checkPlan('static', [path], repository).some(
        ({ task: name }) => name === task,
      );
    const paths = await trace(manifest.scripts[task], task);
    const setting = `${task} in ci/check-plan.ts`;
    if (task === entry.negative.task) {
      strictEqual(paths.includes(entry.negative.path), true);
      throws(
        () =>
          requireSelectedInputs(
            paths,
            (path) => path !== entry.negative.path && selectsTask(path),
            setting,
          ),
        (error) =>
          error.message.includes(setting) &&
          error.actual?.includes(entry.negative.path),
      );
    }
    requireSelectedInputs(paths, selectsTask, setting);
  }

  const workflow = parse(
    readFileSync(join(repository, '.github/workflows/ci.yml'), 'utf8'),
  );
  const packageCommands = workflow.jobs.package.steps.flatMap(
    ({ run }) => run?.trim().split('\n') ?? [],
  );
  const inputs = new Set();
  for (const command of packageCommands) {
    if (command === 'pnpm install --frozen-lockfile') {
      for (const path of [
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
      ])
        inputs.add(path);
      continue;
    }
    const packageScript = /^pnpm (?:run )?([\w:-]+)$/.exec(command)?.[1];
    if (packageScript) {
      for (const path of await trace(
        manifest.scripts[packageScript],
        `package job's ${packageScript}`,
      ))
        inputs.add(path);
      continue;
    }
    const shell = /\bbash\s+(?:\.\/)?(scripts\/[\w/.-]+\.sh)(?=\s|$)/.exec(
      command,
    )?.[1];
    strictEqual(
      typeof shell,
      'string',
      `Trace this package job command in the CI input guard: ${command}`,
    );
    inputs.add(shell);
  }
  strictEqual(
    inputs.has('scripts/build-package.ts'),
    true,
    'Trace the package build entry through package.json',
  );
  strictEqual(
    inputs.has('scripts/check-package.sh'),
    true,
    'Trace the installed-package check through the workflow',
  );
  requireSelectedInputs(
    [...inputs],
    (path) => runtimePlan(false, [path], []).package,
    'package job in ci/runtime-plan.ts',
  );
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
        'ci/package.json',
      ],
      { cwd: repository },
    );
    for (const path of [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'ci/check-plan.ts',
      'vite.config.ts',
      '.github/workflows/ci.yml',
      '.github/workflows/agent-review.yml',
      ...manifests,
    ])
      writeFiles(root, {
        [path]: readFileSync(join(repository, path), 'utf8'),
      });
    writeFiles(root, entry.files);
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
    const base = run('git', ['rev-parse', 'HEAD']).trim();
    const planner = join(repository, 'ci/check-plan.ts');
    const runtimePlanner = 'ci/runtime-plan.ts';
    const workflow = parse(
      readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8'),
    );
    match(
      workflow.jobs.affected.steps.find(({ id }) => id === 'affected').run,
      /^node ci\/runtime-plan\.ts >> "\$GITHUB_OUTPUT"$/m,
    );
    for (const fixture of entry.cases) {
      const path = fixture.path && join(root, fixture.path);
      const original = path && readFileSync(path, 'utf8');
      if (path) {
        writeFileSync(path, original + '\n');
        for (const removed of fixture.remove ?? []) rmSync(join(root, removed));
        run('git', ['add', '--', fixture.path, ...(fixture.remove ?? [])]);
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
          fixture.name,
        ]);
      }
      const plan = (suite) =>
        JSON.parse(
          run(process.execPath, [planner, suite, '--ci', '--list'], {
            DIFF_BASE: base,
            RELEASE_LANE: String(fixture.release ?? false),
          }),
        );
      if (fixture.unitProjects)
        deepStrictEqual(
          plan('unit').map((id) => id.split('#')[0]),
          fixture.unitProjects,
          `${fixture.name}: affected unit projects`,
        );
      strictEqual(
        plan('static').includes('//#test:rules'),
        fixture.rules ?? false,
        `${fixture.name}: test:rules affected selection`,
      );
      const outputs = run(
        process.execPath,
        [join(repository, runtimePlanner)],
        {
          DIFF_BASE: base,
          RELEASE_LANE: String(fixture.release ?? false),
        },
      )
        .trim()
        .split('\n');
      const selected = [
        'server',
        'web-integration',
        'web-e2e',
        'desktop',
        'storage',
        'package',
      ].filter((gate) => {
        const output = outputs.find((line) => line.startsWith(`${gate}=`));
        strictEqual(
          output === `${gate}=true` || output === `${gate}=false`,
          true,
          `${fixture.name}: ${gate} must be a boolean output`,
        );
        return output === `${gate}=true`;
      });
      deepStrictEqual(selected, fixture.selected, fixture.name);
      if (fixture.shards)
        strictEqual(
          outputs.find((line) => line.startsWith('shards=')),
          `shards=${JSON.stringify(fixture.shards)}`,
          `${fixture.name}: web E2E shard output`,
        );
      if (fixture.integration)
        strictEqual(
          outputs.find((line) => line.startsWith('integration=')),
          `integration=${JSON.stringify(fixture.integration)}`,
          `${fixture.name}: integration spec output`,
        );
      if (path) run('git', ['reset', '--hard', '--quiet', base]);
      process.stdout.write(`PASS ci-affected-selection: ${fixture.name}\n`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function styleConfigFixture(entry) {
  const root = fixtureRoot('porcelain-style-config-');
  const repository = fileURLToPath(new URL('../', import.meta.url));
  const run = (command, args) => {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
    if (result.error) throw result.error;
    return result;
  };
  try {
    if (!entry.missingTool)
      symlinkSync(
        join(repository, 'node_modules'),
        join(root, 'node_modules'),
        'dir',
      );
    const files = {
      'package.json': '{"type":"module"}',
      'architecture/fixture.ts': 'export {};',
      'architecture/shadcn-pins.json': '{}',
      ...Object.fromEntries(
        [
          'src/fixture.ts',
          'spec/fixture.ts',
          'vite.config.ts',
          'dev-pair.ts',
          'vitest.config.ts',
          'playwright.config.ts',
        ].map((name) => [`apps/web/${name}`, 'export {};']),
      ),
      'apps/marketing/astro.config.ts': 'export {};',
    };
    for (const name of [
      'vite.config.ts',
      'tsconfig.json',
      'apps/web/tsconfig.json',
      'apps/server/tsconfig.json',
      'packages/access/tsconfig.json',
      ...(entry.target === 'web' ? ['apps/web/tsconfig.node.json'] : []),
    ])
      files[name] = readFileSync(join(repository, name), 'utf8');
    for (const [name, replacements] of Object.entries(entry.json ?? {})) {
      const settings =
        name === 'vite.config.ts'
          ? structuredClone(config)
          : JSON.parse(files[name]);
      for (const [path, value] of Object.entries(replacements)) {
        const keys = path.split('.');
        const key = keys.pop();
        const parent = keys.reduce((at, part) => at[part], settings);
        if (value === undefined) delete parent[key];
        else parent[key] = value;
      }
      const serialized = JSON.stringify(settings);
      files[name] =
        name === 'vite.config.ts'
          ? `export default ${serialized};`
          : serialized;
    }
    writeFiles(root, { ...files, ...entry.files });
    if (entry.target === 'web') {
      for (const source of ['apps/mobile/src', 'packages/client/src'])
        mkdirSync(join(root, source), { recursive: true });
      if (!entry.missingTool)
        symlinkSync(
          join(repository, 'apps/web/node_modules'),
          join(root, 'apps/web/node_modules'),
          'dir',
        );
    }
    symlinkSync(
      join(repository, 'architecture/oxlint-plugin.mjs'),
      join(root, 'architecture/oxlint-plugin.mjs'),
    );
    if (entry.toolOutput !== undefined) {
      writeFiles(root, {
        'node_modules/.bin/vp': `#!/bin/sh\nprintf '%s' '${entry.toolOutput}'\n`,
      });
      chmodSync(join(root, 'node_modules/.bin/vp'), 0o755);
    }
    const initialized = run('git', ['init', '--quiet']);
    strictEqual(initialized.status, 0, initialized.stderr);
    for (const source of serverDuplicateScope().sources)
      mkdirSync(join(root, source), { recursive: true });
    if (entry.tracked) {
      const added = run('git', ['add', entry.tracked]);
      strictEqual(added.status, 0, added.stderr);
    }
    const previous = process.cwd();
    const streams = [
      { stream: process.stdout, key: 'stdout' },
      { stream: process.stderr, key: 'stderr' },
    ].map((entry) => ({
      ...entry,
      descriptor: Object.getOwnPropertyDescriptor(entry.stream, 'write'),
    }));
    const checked = { stdout: '', stderr: '', status: 1, signal: null };
    try {
      process.chdir(root);
      for (const { stream, key } of streams)
        stream.write = (text) => {
          checked[key] += text;
          return true;
        };
      try {
        checked.status = await checkStyle('lint', entry.target ?? 'server');
      } catch (error) {
        checked.stderr += `${error.stack ?? error}\n`;
      }
    } finally {
      process.chdir(previous);
      for (const { stream, descriptor } of streams)
        if (descriptor) Object.defineProperty(stream, 'write', descriptor);
        else Reflect.deleteProperty(stream, 'write');
    }
    const output = checked.stdout + checked.stderr;
    strictEqual(checked.signal, null, `${entry.name}: ${output}`);
    strictEqual(checked.status, entry.status, `${entry.name}: ${output}`);
    const diagnostics = checked.stderr
      .split('\n')
      .filter((line) => line.startsWith('error style('));
    deepStrictEqual(
      [
        ...new Set(
          diagnostics.map((line) => /^error style\(([^)]+)\)/.exec(line)[1]),
        ),
      ].sort(),
      entry.rules,
      `${entry.name}: ${output}`,
    );
    for (const token of entry.tokens ?? [])
      strictEqual(
        diagnostics.some((line) => line.includes(token)),
        true,
        `${entry.name}: missing ${token}\n${output}`,
      );
    for (const key of entry.keys ?? [])
      strictEqual(
        diagnostics.some((line) => line.split(/\W+/).includes(key)),
        true,
        `${entry.name}: missing key ${key}\n${output}`,
      );
    for (const detail of entry.details ?? [])
      strictEqual(
        checked.stderr.includes(detail),
        true,
        `${entry.name}: ${output}`,
      );
    if (entry.order)
      deepStrictEqual(
        diagnostics.map((line) => /^error style\(([^)]+)\)/.exec(line)[1]),
        entry.order,
        output,
      );
    if (entry.stdout !== undefined)
      strictEqual(checked.stdout, entry.stdout, output);
    if (entry.findings)
      deepStrictEqual(
        [...checked.stdout.matchAll(/:\d+:\d+: error ([^:]+):/g)].map(
          (match) => match[1],
        ),
        entry.findings,
        output,
      );
    if (entry.missingTool && entry.toolOutput === undefined)
      strictEqual(output.includes('ENOENT'), entry.rules.length === 0, output);
    else if (entry.status === 0)
      strictEqual(
        checked.stdout.includes(`${entry.findingCount ?? 0} findings.`),
        true,
        output,
      );
  } finally {
    rmSync(root, { recursive: true, force: true });
    strictEqual(existsSync(root), false, `Fixture leaked: ${root}`);
  }
}

function ciActionPinProblems(workflow) {
  const problems = [];
  for (const job of Object.values(workflow.jobs ?? {})) {
    for (const owner of [job, ...(job.steps ?? [])]) {
      if (!Object.hasOwn(owner, 'uses')) continue;
      const action = owner.uses;
      if (
        typeof action === 'string' &&
        (action.startsWith('./') ||
          /^[^/@\s]+\/[^@\s]+@[a-f0-9]{40}$/i.test(action))
      )
        continue;
      problems.push({
        action,
        cause:
          'Third-party CI actions and reusable workflows require a full 40-character commit SHA.',
      });
    }
  }
  return problems;
}

function duplicateRatchetFixture(entry) {
  const root = fixtureRoot('porcelain-clone-baseline-');
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (result.error) throw result.error;
    strictEqual(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    writeFiles(root, {
      'architecture/duplicate-ceilings.json': JSON.stringify(entry.ceilings),
      'ci/one.ts': entry.source,
      'ci/two.ts': entry.source,
    });
    git('init', '-q');
    git('add', '.');
    git(
      '-c',
      'user.name=Duplicate fixture',
      '-c',
      'user.email=duplicate@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'Record duplicate baseline',
    );
    const comparison = duplicateComparison(root, git('rev-parse', 'HEAD'));
    deepStrictEqual(comparison.ceilings, entry.ceilings);
    for (const [name, ceiling] of Object.entries(entry.ceilings)) {
      strictEqual(
        raisedDuplicateCeiling({ name, ceiling }, comparison),
        undefined,
      );
      strictEqual(
        raisedDuplicateCeiling({ name, ceiling: ceiling - 1 }, comparison),
        undefined,
      );
      strictEqual(
        raisedDuplicateCeiling({ name, ceiling: ceiling + 1 }, comparison),
        ceiling,
      );
    }
    const scope = { ...toolingDuplicateScope(root), ceiling: 1 };
    const before = scanDuplicates(root, scope);
    strictEqual(before.exceeded, false);
    deepStrictEqual(
      clonesChangedSince(root, comparison.base, before.duplicates),
      [],
    );
    writeFiles(root, { 'ci/three.ts': entry.source });
    git('add', 'ci/three.ts');
    const after = scanDuplicates(root, scope);
    strictEqual(after.exceeded, true);
    const added = clonesChangedSince(root, comparison.base, after.duplicates);
    strictEqual(added.length, 1);
    strictEqual(
      [added[0].firstFile, added[0].secondFile].some(
        ({ name }) => relative(root, name) === 'ci/three.ts',
      ),
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export async function runGuardrailCases(named = []) {
  const cases = guardrailCases.filter(
    (entry) => named.length === 0 || named.includes(entry.rule),
  );
  strictEqual(
    cases.length > 0,
    true,
    'Name an existing guardrail fixture rule.',
  );
  for (const entry of cases) {
    if (entry.rule === 'repository-sql') {
      deepStrictEqual(repositoryQueryFixture(entry.valid), [entry.query]);
      for (const fixture of entry.cases) {
        throws(
          () => repositoryQueryFixture(fixture.source),
          fixture.error,
          fixture.name,
        );
        process.stdout.write(`PASS repository-sql: ${fixture.name}\n`);
      }
      await checkMigratedRepositoryQueries();
    } else if (entry.rule === 'native-migration-history') {
      for (const fixture of entry.cases) {
        deepStrictEqual(
          nativeMigrationHistoryProblems(entry.shipped, fixture.current),
          fixture.problems,
          fixture.name,
        );
        process.stdout.write(
          `PASS native-migration-history: ${fixture.name}\n`,
        );
      }
    } else if (entry.rule === 'ci-action-pins') {
      for (const fixture of entry.cases) {
        deepStrictEqual(
          ciActionPinProblems(fixture.workflow),
          fixture.problems,
          fixture.name,
        );
        process.stdout.write(`PASS ci-action-pins: ${fixture.name}\n`);
      }
      deepStrictEqual(
        ciActionPinProblems(
          parse(
            readFileSync(
              new URL('../.github/workflows/ci.yml', import.meta.url),
              'utf8',
            ),
          ),
        ),
        [],
        'ci.yml must pin every third-party action and reusable workflow to a full commit SHA.',
      );
      process.stdout.write('PASS ci-action-pins: actual ci.yml\n');
    } else if (entry.rule === 'ci-affected-selection') {
      ciSelectionFixture(entry);
    } else if (entry.rule === 'ci-task-inputs') {
      await checkCiInputs(entry);
    } else if (entry.rule === 'ci-landing-completion') {
      const workflow = parse(
        readFileSync(
          new URL('../.github/workflows/agent-review.yml', import.meta.url),
          'utf8',
        ),
      );
      deepStrictEqual(workflow.on.workflow_run, entry.workflowRun);
      doesNotMatch(
        workflow.jobs.review.if,
        /\bworkflow_run\s*\.\s*conclusion\b/,
        'The landing job must reconcile every conclusion of pull request CI.',
      );
    } else if (entry.rule === 'ci-required-checks') {
      const workflow = parse(
        readFileSync(
          new URL('../.github/workflows/ci.yml', import.meta.url),
          'utf8',
        ),
      );
      const installs = Object.entries(workflow.jobs).flatMap(([name, job]) =>
        (job.steps ?? [])
          .filter((step) => step.uses?.startsWith('pnpm/setup@'))
          .map((step) => ({ name, step, setup: step.with })),
      );
      deepStrictEqual(
        installs
          .filter(({ setup }) => setup.cache)
          .map(({ name }) => name)
          .toSorted((left, right) => left.localeCompare(right)),
        [entry.dependencyStoreWriter, ...entry.dependencyStoreReaders].toSorted(
          (left, right) => left.localeCompare(right),
        ),
        'Every Linux dependency-store reader keeps restoring the cache',
      );
      deepStrictEqual(
        installs
          .filter(({ setup }) => setup.cache && (setup['save-cache'] ?? true))
          .map(({ name }) => name),
        [entry.dependencyStoreWriter],
        'Only the full Linux unit install publishes the dependency store',
      );
      const writer = workflow.jobs[entry.dependencyStoreWriter];
      strictEqual(writer['runs-on'], 'ubuntu-latest');
      strictEqual(writer.if, undefined);
      strictEqual(writer.needs, undefined);
      strictEqual(writer.strategy, undefined);
      strictEqual(
        installs.find(({ name }) => name === entry.dependencyStoreWriter).step
          .if,
        undefined,
      );
      for (const { name, setup } of installs) {
        strictEqual(setup['require-lockfile'], true, name);
        strictEqual(setup.install ?? true, true, name);
        strictEqual(setup['working-directory'] ?? '.', '.', name);
        strictEqual(setup['package-json-file'], undefined, name);
      }
      strictEqual(
        workflow.jobs.units.steps.find((step) =>
          step.run?.includes('check:unit'),
        )?.run,
        entry.unitCommand,
        'CI runs unit projects through affected task selection',
      );
      const integration = workflow.jobs['web-integration'];
      deepStrictEqual(
        integration.strategy.matrix.shard,
        entry.webIntegrationShards,
      );
      strictEqual(
        integration.steps.find((step) => step.run?.includes('--shard='))?.run,
        entry.webIntegrationCommand,
      );
      const browser = workflow.jobs['web-e2e'];
      strictEqual(browser.strategy.matrix.shard, entry.webE2eShardPlan);
      deepStrictEqual(workflow.env, {
        RELEASE_LANE: "${{ github.base_ref == 'release' }}",
        DIFF_BASE:
          '${{ github.event.pull_request.base.sha || github.event.before }}',
      });
      for (const fixture of entry.webE2eCases) {
        const release = fixture.specs.length === 0;
        const runBrowser = browser.steps.find(
          (step) =>
            step.if ===
            (release
              ? "github.base_ref == 'release'"
              : "github.base_ref != 'release'"),
        );

        const shell = `pnpm() {
  [[ "$1 $2 $3" == "--filter @porcelain/web test:e2e" ]] || return 2
  shift 3
  printf '%s\\n' "$*"
  [[ "$1" != "$REJECT" ]]
}
${runBrowser.run
  .replace('${{ matrix.shard }}', '"$SHARD"')
  .replace('${{ strategy.job-total }}', '"$JOB_TOTAL"')}`;
        const result = spawnSync(
          'bash',
          ['-e', '-o', 'pipefail', '-c', shell],
          {
            encoding: 'utf8',
            env: {
              ...process.env,
              SHARD: fixture.shard,
              JOB_TOTAL: fixture.jobTotal ?? '1',
              SPECS: JSON.stringify(fixture.specs),
              REJECT: fixture.reject ?? '',
            },
          },
        );
        if (result.error) throw result.error;
        strictEqual(result.status, fixture.status, fixture.name);
        deepStrictEqual(
          result.stdout.trim().split('\n'),
          fixture.commands,
          fixture.name,
        );
        process.stdout.write(`PASS ci-required-checks: ${fixture.name}\n`);
      }
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
    } else if (entry.rule === 'style-config') {
      for (const fixture of entry.cases) {
        await styleConfigFixture(fixture);
        process.stdout.write(`PASS style-config: ${fixture.name}\n`);
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
        writeFiles(root, { 'package.json': '{"type":"module"}' });
        for (const [source, errors] of [
          [entry.valid, []],
          [entry.invalid, entry.errors],
        ]) {
          writeFiles(root, { [entry.path ?? 'fixture.ts']: source });
          const checked = spawnSync(
            join(repository, 'node_modules/.bin/vp'),
            [
              'lint',
              '--config',
              join(repository, 'vite.config.ts'),
              '--format',
              'json',
              join(root, entry.path ?? 'fixture.ts'),
            ],
            { encoding: 'utf8', cwd: root },
          );
          if (checked.error) throw checked.error;
          if (!checked.stdout) throw new Error(checked.stderr);
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
    } else if (entry.rule === 'duplicate-ceiling') {
      duplicateRatchetFixture(entry);
    } else if (entry.rule === 'duplicate-code') {
      deepStrictEqual(duplicateFixture(entry, entry.valid), {
        rejected: false,
        pairs: [],
      });
      deepStrictEqual(duplicateFixture(entry, entry.invalid), {
        rejected: entry.rejected ?? true,
        pairs:
          entry.rejected === false
            ? []
            : [
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

if (import.meta.main) await runGuardrailCases(process.argv.slice(2));
