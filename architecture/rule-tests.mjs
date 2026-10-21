import { fileURLToPath } from 'node:url';
import { deepStrictEqual, throws, ok } from 'node:assert/strict';
import { RuleTester } from 'oxlint/plugins-dev';
import { parseSync } from 'oxc-parser';
import plugin from './oxlint-plugin.mjs';
import { runGuardrailCases } from './guardrail-tests.mjs';

import ruleCases, { specGapCases, specGapRatchetCases } from './rule-cases.mjs';
import { unspecifiedExports, specGapProblems } from './spec-gaps.mjs';
for (const fixture of specGapCases)
  deepStrictEqual(
    unspecifiedExports(
      'packages/client/src/features/files/rules/sample.ts',
      fixture.source,
      fixture.spec,
      (path) => fixture.files?.[path],
    ),
    fixture.gaps,
  );
process.stdout.write(
  'PASS spec-gap fixtures: runtime references, callbacks, namespaces, missing specs, types and barrels\n',
);
import { runBoundaryCases } from './boundary-tests.mjs';
const root = new URL('../', import.meta.url);
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { domainPackages } from './policy.ts';
import boundaryCases from './boundary-cases.mjs';
import { guardrailCases } from './rule-cases.mjs';

function diagnosticFixture(entry) {
  const directory = mkdtempSync(join(tmpdir(), 'porcelain-diagnostic-'));
  const write = (file, source) => {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    writeFileSync(join(directory, file), source);
  };
  try {
    symlinkSync(
      fileURLToPath(new URL('node_modules', root)),
      join(directory, 'node_modules'),
      'dir',
    );
    for (const path of [
      'scripts/architecture.ts',
      'architecture/type-rules.ts',
      'architecture/policy.ts',
      'architecture/dependency-cruiser.cjs',
      'scripts/style.ts',
      'architecture/duplicate-policy.ts',
      'architecture/shadcn-pins.ts',
    ]) {
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      cpSync(new URL(path, root), join(directory, path));
    }
    mkdirSync(join(directory, 'apps/web/spec'), { recursive: true });
    write('package.json', '{"type":"module"}');
    write('tsconfig.json', '{}');
    for (const owner of [
      ...domainPackages.map((name) => `packages/${name}`),
      'packages/kernel',
      'apps/server',
    ])
      write(
        `${owner}/tsconfig.json`,
        JSON.stringify({
          compilerOptions: {
            target: 'esnext',
            module: 'nodenext',
            noEmit: true,
          },
          include: ['src/**/*.ts'],
        }),
      );
    for (const file of [
      'apps/web/vitest.config.ts',
      'apps/web/playwright.config.ts',
      'apps/mobile/app.config.ts',
    ])
      write(file, 'export {};');
    write('apps/mobile/metro.config.cjs', 'module.exports = {};');
    write(
      'apps/web/vite.config.ts',
      'export default { resolve: { alias: {} } };',
    );
    write('apps/web/src/main.tsx', 'export const value = 1;');
    write('apps/mobile/src/app/index.tsx', 'export const value = 1;');
    for (const [file, source] of Object.entries(entry.files ?? {}))
      write(file, source);
    const imports = [];
    if (entry.lint) {
      write('apps/web/dev-pair.ts', 'export {};');
      write('apps/marketing/astro.config.ts', 'export {};');
      cpSync(new URL('architecture', root), join(directory, 'architecture'), {
        recursive: true,
      });
      for (const path of [
        '.oxlintrc.json',
        '.oxfmtrc.json',
        'tsconfig.json',
        'apps/web/tsconfig.json',
        'apps/server/tsconfig.json',
        ...[...domainPackages, 'kernel'].map(
          (name) => `packages/${name}/tsconfig.json`,
        ),
      ]) {
        mkdirSync(dirname(join(directory, path)), { recursive: true });
        cpSync(new URL(path, root), join(directory, path));
      }
      write(
        'lint.mjs',
        `import { registerHooks } from 'node:module';
registerHooks({ load(url, context, next) {
  if (url === 'node:child_process') return { format: 'module', shortCircuit: true, source: 'export function spawnSync() { return { stdout: JSON.stringify({ number_of_files: 0, diagnostics: [] }), stderr: String(), status: 0 }; }' };
  return next(url, context);
} });`,
      );
      imports.push('--import', join(directory, 'lint.mjs'));
    }
    if (entry.scan) {
      write(
        'scanner.mjs',
        `import { registerHooks } from 'node:module';
registerHooks({ load(url, context, next) {
  if (url.endsWith('/dependency-cruiser/src/main/index.mjs')) return { format: 'module', shortCircuit: true, source: ${JSON.stringify(`export async function cruise() { ${entry.scan} }`)} };
  return next(url, context);
} });`,
      );
      imports.push('--import', join(directory, 'scanner.mjs'));
    }
    const result = spawnSync(
      process.execPath,
      [
        ...imports,
        join(
          directory,
          entry.lint ? 'scripts/style.ts' : 'scripts/architecture.ts',
        ),
        ...(entry.lint ? ['lint', 'server'] : ['check', '--all']),
      ],
      { cwd: directory, encoding: 'utf8' },
    );
    if (result.error) throw result.error;
    const output = result.stdout + result.stderr;
    deepStrictEqual(
      result.status,
      entry.status ?? 1,
      `${entry.name}: ${output}`,
    );
    for (const expected of entry.expected)
      ok(
        output.includes(expected),
        `${entry.name}: expected ${expected}\n${output}`,
      );
    for (const absent of [
      'ENOENT',
      'ERR_MODULE_NOT_FOUND',
      'SyntaxError',
      ...(entry.absent ?? []),
    ])
      ok(!output.includes(absent), `${entry.name}: ${output}`);
    process.stdout.write(`PASS diagnostic ${entry.name}: ${output}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
const folderReason =
  'Move source into its runtime and responsibility folder (apps/<app>/src or packages/<owner>/src with the role this rule permits), because unowned folders hide which layer may import it, even when it has no imports.';
const diagnosticCases = [
  { name: 'valid-source', status: 0, expected: ['0 violations;'] },
  ...[
    'source-folder-isolated',
    'source-folder-connected',
    'portable-imports-no-node',
  ].map((rule) => ({
    name: rule,
    files: boundaryCases.find((entry) => entry.rule === rule).invalid,
    expected: [
      `${rule}: 1`,
      rule === 'portable-imports-no-node'
        ? 'Use a platform port for Node capabilities, because domain decisions and shared clients run outside Node; only node:crypto in domain/kernel rules retains the existing hashing exception.'
        : folderReason,
    ],
  })),
  {
    name: 'theme-imports-stylesheets-only',
    files: {
      'apps/web/src/features/files/views/theme.css':
        '@import "@porcelain/theme/tokens.css";',
    },
    expected: [
      'theme-imports-stylesheets-only: 1',
      'apps/web/src/features/files/views/theme.css -> @porcelain/theme/tokens.css',
      'why: Import @porcelain/theme/tokens.css only from a top-level web or mobile src stylesheet, because one app stylesheet owns the shared theme tokens.',
    ],
  },
  {
    name: 'theme-long-path',
    files: {
      'apps/web/src/features/files/views/long-review-walkthrough-with-remote-environment-and-worktree-context.css':
        '@import "@porcelain/theme/private.css";',
    },
    expected: [
      'theme-imports-stylesheets-only: 1',
      'apps/web/src/features/files/views/long-review-walkthrough-with-remote-environment-and-worktree-context.css -> @porcelain/theme/private.css',
      'because one app stylesheet owns the shared theme tokens.',
    ],
  },
  ...['worktree-use-case-checks', 'lane-mode-matches-service'].map((rule) => {
    const entry = guardrailCases.find((entry) => entry.rule === rule);
    return {
      name: rule,
      files: { ...entry.files, ...entry.invalid },
      expected: [
        `${rule}: 1`,
        rule === 'worktree-use-case-checks'
          ? 'resolve it with this.checkWorktree.execute before using it, or hand it to a use case that does, because the catalog must resolve the worktree before its files are accessed'
          : "call it inside a 'write' lane, lanes.background or the shutdown context lanes.finish, never in read lane, because a read lane cannot serialize a service that writes",
      ],
    };
  }),
  {
    name: 'scanner-formatted-output',
    scan: 'return { output: "formatted" };',
    expected: [
      'Configure dependency-cruiser to return its native graph, because architecture checks need modules and violations rather than formatted output.',
    ],
    absent: ['0 violations;'],
  },
  {
    name: 'scanner-omitted-source',
    scan: 'return { output: { modules: [], summary: { violations: [] } } };',
    expected: [
      'Dependency scan omitted source files:',
      'apps/web/src/main.tsx',
      'restore these files to the dependency-cruiser scan inputs and resolution, because an unscanned source can bypass architecture checks.',
    ],
    absent: ['0 violations;'],
  },
  {
    name: 'scanner-partial-source',
    scan: 'return { output: { modules: [{ source: "apps/web/src/main.tsx" }], summary: { violations: [] } } };',
    expected: [
      'Dependency scan omitted source files: apps/mobile/src/app/index.tsx',
      'because an unscanned source can bypass architecture checks.',
    ],
    absent: ['0 violations;'],
  },
  {
    name: 'lint-omitted-source',
    lint: true,
    expected: [
      'lint skipped files: oxlint read 0 of the',
      'restore the lint inputs or configuration so every source is checked, because omitted files bypass the shared lint policy.',
    ],
    absent: ['error style('],
  },
  {
    name: 'scanner-tool-failure',
    scan: 'throw new Error("fixture dependency scanner unavailable");',
    expected: ['fixture dependency scanner unavailable'],
    absent: ['Dependency scan omitted source files:', '0 violations;'],
  },
];
for (const entry of diagnosticCases) diagnosticFixture(entry);
if (process.argv.includes('--diagnostics')) {
  runGuardrailCases(
    guardrailCases
      .filter((entry) => entry.rule.startsWith('feature-map-'))
      .map((entry) => entry.rule),
  );
  process.exit(0);
}

for (const fixture of specGapRatchetCases)
  deepStrictEqual(
    specGapProblems(fixture.current, fixture.baseline, fixture.allowed),
    fixture.errors,
  );
await runBoundaryCases();
if (process.argv.includes('--boundaries')) process.exit(0);
import { readFileSync } from 'node:fs';
function requireReason(message) {
  ok(
    /\b(?:because|so)\b\s+\S/.test(message),
    `A lint message explains why: ${message}`,
  );
}
function checkMessageSource(node) {
  if (node === null || typeof node !== 'object') return;
  const text =
    node.type === 'Literal' && typeof node.value === 'string'
      ? node.value
      : node.type === 'TemplateLiteral'
        ? node.quasis.map((part) => part.value.raw).join('value')
        : '';
  if (text.includes(' ') && text.endsWith('.')) requireReason(text);
  const message =
    node.type === 'Property' && node.key.name === 'message'
      ? node.value
      : node.type === 'CallExpression' && node.callee.name === 'problem'
        ? node.arguments[1]
        : undefined;
  if (message?.type === 'Literal') requireReason(message.value);
  if (message?.type === 'TemplateLiteral')
    requireReason(message.quasis.map((part) => part.value.raw).join('value'));
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(checkMessageSource);
    else if (value !== null && typeof value === 'object')
      checkMessageSource(value);
  }
}
for (const path of [
  'architecture/oxlint-plugin.mjs',
  'architecture/native-http-rules.mjs',
  'architecture/web-rules.mjs',
  'architecture/mobile-rules.mjs',
  'architecture/hollow-tests.mjs',
  'architecture/shadcn-pins.ts',
  'scripts/style.ts',
]) {
  const source = readFileSync(new URL(path, root), 'utf8');
  checkMessageSource(parseSync(path, source).program);
}
throws(
  () => requireReason('A feature route registers one endpoint.'),
  /explains why/,
);
requireReason(
  'A route registers one endpoint, because every endpoint needs its own contract.',
);

const filename = fileURLToPath(
  new URL('apps/web/src/features/files/views/rule-fixture.tsx', root),
);
function checkedRule(rule) {
  return {
    ...rule,
    create(context) {
      const checked = Object.create(context);
      Object.defineProperty(checked, 'report', {
        value(report) {
          requireReason(report.message);
          context.report(report);
        },
      });
      return rule.create(checked);
    },
  };
}

function fixtureCode(path, code) {
  ok(
    typeof code === 'string' && code.trim().length > 0,
    `${path} needs a good and bad sample`,
  );
  deepStrictEqual(
    parseSync(path, code, { lang: 'tsx' }).errors,
    [],
    `${path} must parse before testing its rule`,
  );
  return code;
}

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'tsx' } },
});
const cases = [
  {
    rule: 'web-no-module-mutable-binding',
    valid: 'export const count = 0;',
    invalid: 'export let count = 0;',
  },
  {
    rule: 'web-no-context',
    valid: 'export const count = 0;',
    invalid:
      "import * as React from 'react'; export const store = React.createContext(0);",
  },
  {
    rule: 'web-no-manual-memo',
    valid: 'export const title = () => "File";',
    invalid:
      "import { useMemo } from 'react'; export const title = () => useMemo(() => 'File', []);",
  },
  {
    rule: 'web-views-no-await',
    valid: 'export const save = (command: () => void) => command();',
    invalid:
      'export const save = async (command: () => Promise<void>) => { await command(); };',
  },
  {
    rule: 'web-views-no-promise-chains',
    valid: 'export const save = (command: () => void) => command();',
    invalid:
      'export const save = (command: () => Promise<void>) => command().then(() => {});',
  },
  {
    rule: 'web-views-no-try',
    valid: 'export const save = (command: () => void) => command();',
    invalid:
      'export const save = (command: () => void) => { try { command(); } catch {} };',
  },
];
const started = performance.now();
runGuardrailCases();

for (const entry of cases)
  tester.run(entry.rule, checkedRule(plugin.rules[entry.rule]), {
    valid: [{ filename, code: entry.valid }],
    invalid: [{ filename, code: entry.invalid, errors: 1 }],
  });
for (const entry of ruleCases) {
  const at = fileURLToPath(new URL(entry.path, root));
  try {
    const goodPath = entry.validPath ?? entry.path;
    const goodFile = fileURLToPath(new URL(goodPath, root));
    tester.run(entry.rule, checkedRule(plugin.rules[entry.rule]), {
      valid: [{ filename: goodFile, code: fixtureCode(goodPath, entry.valid) }],
      invalid: [
        {
          filename: at,
          code: fixtureCode(entry.path, entry.invalid),
          errors: entry.errors,
        },
      ],
    });
  } catch (error) {
    throw new Error(`${entry.rule} fixture at ${entry.path}`, {
      cause: error,
    });
  }
}
const fixtured = new Set([
  ...cases.map((entry) => entry.rule),
  ...ruleCases.map((entry) => entry.rule),
]);
const unfixtured = Object.keys(plugin.rules).filter(
  (rule) => !fixtured.has(rule),
);
if (unfixtured.length > 0)
  throw new Error(
    `Every porcelain rule has a fixture its rule rejects in architecture/rule-cases.mjs; these have none: ${unfixtured.join(', ')}`,
  );
process.stdout.write(
  `PASS ${fixtured.size} rules, ${cases.length + ruleCases.length} fixtures (${Math.round(performance.now() - started)} ms)\n`,
);
