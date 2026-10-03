import { fileURLToPath } from 'node:url';
import { deepStrictEqual, throws, ok } from 'node:assert/strict';
import { RuleTester } from 'oxlint/plugins-dev';
import { parseSync } from 'oxc-parser';
import plugin from './oxlint-plugin.mjs';
import ruleCases, { scriptCases, scriptEvasions } from './rule-cases.mjs';
import { scriptInvokes } from './script-policy.ts';
import { architectureLines } from './guardrail-budget.ts';
import { readFileSync } from 'node:fs';
import { manualAuditProblems } from './ci-policy.ts';
import { preflightEdits } from './probe-edits.ts';
import { classify, violation } from './policy.ts';
import {
  mobileGeneratedTypesValid,
  mobileMetroValid,
  mobileStylesValid,
  themeManifestValid,
  themeTokensValid,
} from './theme-policy.ts';

for (const entry of scriptCases) {
  deepStrictEqual(
    scriptInvokes(entry.valid, entry.required, entry.folder),
    true,
    entry.valid,
  );
  deepStrictEqual(
    scriptInvokes(entry.invalid, entry.required, entry.folder),
    false,
    entry.invalid,
  );
}
for (const [source, required] of scriptEvasions)
  deepStrictEqual(scriptInvokes(source, required, '.'), false, source);
deepStrictEqual(
  scriptInvokes(
    'tsc --noEmit&&tsc -p tsconfig.node.json --noEmit',
    [
      ['tsc', '--noEmit'],
      ['tsc', '--noEmit', '-p', 'tsconfig.node.json'],
    ],
    '.',
  ),
  true,
);
deepStrictEqual(architectureLines(['', 'one', 'two\n', 'three\nfour']), 4);

const root = new URL('../', import.meta.url);
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
  'architecture/web-rules.mjs',
  'architecture/mobile-rules.mjs',
  'architecture/hollow-tests.mjs',
  'architecture/react-compiler.ts',
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
tester.run(
  'no-number-outside-limits',
  checkedRule(plugin.rules['no-number-outside-limits']),
  {
    valid: [
      {
        filename: fileURLToPath(
          new URL('apps/mobile/src/config/limits.ts', root),
        ),
        code: 'export const REQUEST_TIMEOUT_MS = 15_000;',
      },
    ],
    invalid: [
      {
        filename: fileURLToPath(
          new URL('apps/mobile/src/shared/api/transport.ts', root),
        ),
        code: 'export const timeout = () => AbortSignal.timeout(15_000);',
        errors: 1,
      },
    ],
  },
);
for (const [file, role] of [
  ['index.ts', 'client-feature-api'],
  ['api.ts', 'client-request-api'],
  ['api.spec.ts', 'client-feature-spec'],
  ['store.ts', 'store'],
  ['store.spec.ts', 'client-feature-spec'],
  ['queries/environments.ts', 'query'],
  ['commands/pairing.ts', 'command'],
  ['commands/pairing.spec.ts', 'client-feature-spec'],
  ['ports/credentials.ts', 'client-port'],
])
  deepStrictEqual(classify(`packages/client/src/features/access/${file}`), {
    role,
    owner: 'client',
  });
for (const file of [
  'views/environment.tsx',
  'adapters/credentials.ts',
  'commands/nested/pairing.ts',
  'ports/credentials.spec.ts',
])
  deepStrictEqual(
    classify(`packages/client/src/features/access/${file}`),
    undefined,
  );
for (const role of ['api', 'command', 'query'])
  deepStrictEqual(
    violation(
      { role, owner: role === 'api' ? 'web' : 'client' },
      { role: 'client-request-api', owner: 'client' },
    ),
    undefined,
  );
deepStrictEqual(
  violation(
    { role: 'view', owner: 'mobile' },
    { role: 'client-request-api', owner: 'client' },
  ),
  'view-cannot-import-client-request-api',
);
deepStrictEqual(
  violation(
    { role: 'client-feature-api', owner: 'client' },
    { role: 'client-request-api', owner: 'client' },
  ),
  'client-feature-api-cannot-import-client-request-api',
);
deepStrictEqual(
  violation(
    { role: 'view', owner: 'mobile' },
    { role: 'client-feature-api', owner: 'client' },
  ),
  undefined,
);
deepStrictEqual(
  violation(
    { role: 'api', owner: 'web' },
    { role: 'client-port', owner: 'client' },
  ),
  'client-public-api-only',
);
deepStrictEqual(classify('packages/client/src/shared/api/index.ts'), {
  role: 'client-transport-api',
  owner: 'client',
});
deepStrictEqual(classify('packages/client/src/shared/api/request.ts'), {
  role: 'web-shared',
  owner: 'client',
});
deepStrictEqual(classify('packages/client/src/shared/api/request.spec.ts'), {
  role: 'client-transport-spec',
  owner: 'client',
});
deepStrictEqual(
  classify('packages/client/src/shared/api/nested/request.ts'),
  undefined,
);
deepStrictEqual(
  violation(
    { role: 'api', owner: 'web' },
    { role: 'client-transport-api', owner: 'client' },
  ),
  undefined,
);
deepStrictEqual(
  violation(
    { role: 'view', owner: 'mobile' },
    { role: 'client-transport-api', owner: 'client' },
  ),
  'view-cannot-import-client-transport-api',
);
deepStrictEqual(
  violation(
    { role: 'api', owner: 'web' },
    { role: 'web-shared', owner: 'client' },
  ),
  'client-public-api-only',
);
deepStrictEqual(
  classify('packages/client/src/features/access/rules/index.ts'),
  {
    role: 'client-rules-api',
    owner: 'client',
  },
);
deepStrictEqual(
  classify('packages/client/src/features/access/rules/pairing-link.ts'),
  {
    role: 'web-rule',
    owner: 'client',
  },
);
deepStrictEqual(
  classify('packages/client/src/features/access/rules/pairing-link.spec.ts'),
  {
    role: 'web-rule-spec',
    owner: 'client',
  },
);
deepStrictEqual(
  classify('packages/client/src/features/access/rules/nested/pairing-link.ts'),
  undefined,
);
deepStrictEqual(
  violation(
    { role: 'web-rule', owner: 'client' },
    { role: 'contract', owner: 'contracts' },
  ),
  undefined,
);
deepStrictEqual(
  violation(
    { role: 'web-rule', owner: 'client' },
    { role: 'web-rule', owner: 'web' },
  ),
  'client-imports-client-and-contracts-only',
);
deepStrictEqual(
  violation(
    { role: 'view', owner: 'web' },
    { role: 'client-rules-api', owner: 'client' },
  ),
  undefined,
);
deepStrictEqual(
  violation(
    { role: 'view', owner: 'web' },
    { role: 'web-rule', owner: 'client' },
  ),
  'client-public-api-only',
);
deepStrictEqual(
  classify('packages/client/spec/integration/files.integration.ts'),
  {
    role: 'client-integration-test',
    owner: 'client',
  },
);
deepStrictEqual(classify('packages/client/spec/kit/connection.ts'), {
  role: 'client-test-kit',
  owner: 'client',
});
deepStrictEqual(
  violation(
    { role: 'client-integration-test', owner: 'client' },
    { role: 'server-kit', owner: 'server' },
  ),
  undefined,
);
deepStrictEqual(
  violation(
    { role: 'client-integration-test', owner: 'client' },
    { role: 'bootstrap', owner: 'server' },
  ),
  'client-imports-client-and-contracts-only',
);
deepStrictEqual(
  violation(
    { role: 'query', owner: 'client' },
    { role: 'server-kit', owner: 'server' },
  ),
  'client-imports-client-and-contracts-only',
);
for (const entry of cases)
  tester.run(entry.rule, checkedRule(plugin.rules[entry.rule]), {
    valid: [{ filename, code: entry.valid }],
    invalid: [{ filename, code: entry.invalid, errors: 1 }],
  });
for (const entry of ruleCases) {
  const at = fileURLToPath(new URL(entry.path, root));
  try {
    tester.run(entry.rule, checkedRule(plugin.rules[entry.rule]), {
      valid: [{ filename: at, code: fixtureCode(entry.path, entry.valid) }],
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

const path = '.github/workflows/probes.yml';
const audit = {
  on: { workflow_dispatch: null },
  jobs: {
    probes: {
      strategy: { matrix: { shard: [1, 2] } },
      steps: [{ run: 'pnpm probes --shard ${{ matrix.shard }}/2' }],
    },
  },
};
deepStrictEqual(manualAuditProblems(new Map([[path, audit]])), []);
deepStrictEqual(
  manualAuditProblems(
    new Map([[path, { ...audit, on: { pull_request: null } }]]),
  ),
  [
    '.github/workflows/probes.yml: expensive audits run on explicit workflow_dispatch or one weekly schedule, because routine pushes must not run the full audit.',
  ],
);
deepStrictEqual(
  manualAuditProblems(new Map([[path, { ...audit, jobs: {} }]])),
  [
    'Exactly one audit job runs the probe suite, so shards do not duplicate the audit.',
  ],
);
deepStrictEqual(
  manualAuditProblems(
    new Map([
      [
        path,
        {
          ...audit,
          jobs: {
            probes: {
              ...audit.jobs.probes,
              strategy: { matrix: { shard: [1] } },
            },
          },
        },
      ],
    ]),
  ),
  [
    '.github/workflows/probes.yml job probes: the audit shards plant every probe exactly once, so no probe is silently omitted.',
  ],
);
deepStrictEqual(
  manualAuditProblems(
    new Map([
      [path, audit],
      ['.github/workflows/web.yml', { on: { push: null }, jobs: {} }],
    ]),
  ),
  [
    '.github/workflows/web.yml: expensive audits run on explicit workflow_dispatch, because routine pushes must not run the full audit.',
  ],
);
for (const on of [
  { workflow_dispatch: null, schedule: [{ cron: '23 6 * * 1' }] },
  { schedule: [{ cron: '23 6 * * 1' }], workflow_dispatch: null },
])
  deepStrictEqual(manualAuditProblems(new Map([[path, { ...audit, on }]])), []);
for (const on of [
  { workflow_dispatch: null, schedule: [{ cron: '23 6 * * *' }] },
  {
    workflow_dispatch: null,
    schedule: [{ cron: '23 6 * * 1' }, { cron: '23 6 * * 2' }],
  },
  { schedule: [{ cron: '23 6 * * 1' }] },
  { workflow_dispatch: null, push: null },
])
  ok(
    manualAuditProblems(new Map([[path, { ...audit, on }]])).some((problem) =>
      problem.includes('weekly schedule'),
    ),
  );
ok(
  manualAuditProblems(
    new Map([
      [path, audit],
      [
        '.github/workflows/web.yml',
        {
          on: { workflow_dispatch: null, schedule: [{ cron: '23 6 * * 1' }] },
          jobs: {},
        },
      ],
    ]),
  ).some((problem) => problem.startsWith('.github/workflows/web.yml')),
);

const source = new Map([['fixture.ts', 'old']]);
preflightEdits(
  [
    { kind: 'replace', path: 'fixture.ts', old: 'old', new: 'new' },
    { kind: 'replace', path: 'fixture.ts', old: 'new', new: 'final' },
    { kind: 'create', path: 'created.ts', content: 'one' },
    { kind: 'append', path: 'created.ts', content: 'two' },
  ],
  (name) => source.get(name),
);
deepStrictEqual([...source], [['fixture.ts', 'old']]);
throws(
  () =>
    preflightEdits(
      [{ kind: 'replace', path: 'fixture.ts', old: 'missing', new: 'new' }],
      (name) => source.get(name),
    ),
  /no longer holds the text/,
);
throws(
  () =>
    preflightEdits(
      [{ kind: 'create', path: 'fixture.ts', content: 'new' }],
      (name) => source.get(name),
    ),
  /already exists/,
);
throws(
  () =>
    preflightEdits(
      [{ kind: 'append', path: 'missing.ts', content: 'new' }],
      (name) => source.get(name),
    ),
  /no longer exists/,
);
process.stdout.write(
  'PASS manual audit policy and read-only fixture preflight\n',
);

deepStrictEqual(classify('apps/mobile/src/app/index.tsx'), {
  role: 'route',
  owner: 'mobile',
});
deepStrictEqual(classify('apps/mobile/src/config/limits.ts'), {
  role: 'web-limits',
  owner: 'mobile',
});
deepStrictEqual(classify('apps/mobile/src/shared/icons/tab-icon.android.ts'), {
  role: 'web-shared',
  owner: 'mobile',
});
deepStrictEqual(
  classify('apps/mobile/src/features/files/views/files-screen.tsx'),
  { role: 'view', owner: 'mobile' },
);
deepStrictEqual(
  classify('apps/mobile/src/features/files/views/nested/view.tsx'),
  undefined,
);
deepStrictEqual(
  violation(
    { role: 'view', owner: 'mobile' },
    { role: 'web-shared', owner: 'mobile' },
  ),
  undefined,
);
deepStrictEqual(
  violation({ role: 'view', owner: 'mobile' }, { role: 'api', owner: 'web' }),
  'mobile-imports-mobile-client-and-contracts-only',
);
process.stdout.write('PASS mobile classification and app boundary\n');
for (const [file, role] of [
  ['store.ts', 'mobile-store'],
  ['api.ts', 'api'],
  ['queries/environments.ts', 'query'],
  ['commands/pairing.ts', 'command'],
  ['adapters/environment-storage.ts', 'adapter'],
])
  deepStrictEqual(classify(`apps/mobile/src/features/access/${file}`), {
    role,
    owner: 'mobile',
  });
deepStrictEqual(
  violation(
    { role: 'mobile-store', owner: 'mobile' },
    { role: 'adapter', owner: 'mobile' },
  ),
  undefined,
);
for (const role of ['query', 'command']) {
  deepStrictEqual(
    violation(
      { role, owner: 'mobile' },
      { role: 'mobile-store', owner: 'mobile' },
    ),
    undefined,
  );
  deepStrictEqual(
    violation({ role, owner: 'mobile' }, { role: 'adapter', owner: 'mobile' }),
    `${role}-cannot-import-adapter`,
  );
}
deepStrictEqual(
  violation({ role: 'store', owner: 'web' }, { role: 'adapter', owner: 'web' }),
  'store-cannot-import-adapter',
);
process.stdout.write(
  'PASS native platform composition and shared state boundaries\n',
);

deepStrictEqual(classify('packages/theme/src/tokens.css'), {
  role: 'theme-tokens',
  owner: 'theme',
});
deepStrictEqual(classify('packages/theme/src/runtime.ts'), undefined);
deepStrictEqual(classify('apps/mobile/src/app.css'), {
  role: 'app-stylesheet',
  owner: 'mobile',
});
deepStrictEqual(
  classify('apps/mobile/src/features/files/views/styles.css'),
  undefined,
);
deepStrictEqual(classify('apps/mobile/metro.config.cjs'), {
  role: 'mobile-metro-config',
  owner: 'mobile',
});
for (const owner of ['web', 'mobile'])
  deepStrictEqual(
    violation(
      { role: 'app-stylesheet', owner },
      { role: 'theme-tokens', owner: 'theme' },
    ),
    undefined,
  );
for (const owner of ['client', 'server', 'web', 'mobile'])
  deepStrictEqual(
    violation(
      { role: 'view', owner },
      { role: 'theme-tokens', owner: 'theme' },
    ),
    'theme-imports-stylesheets-only',
  );
const tokenSource =
  '@theme inline { --color-background: var(--background); } @layer theme { :root { --radius: 0.625rem; @variant light { --background: white; } @variant dark { --background: black; } } }';
deepStrictEqual(themeTokensValid(tokenSource), true);
for (const invalid of [
  '.button { color: red; }',
  '@import "tailwindcss";',
  '@theme inline { color: red; }',
  '@theme inline { --background: url("https://example.com"); }',
  '@layer theme { :root { --radius: 1rem; }',
])
  deepStrictEqual(themeTokensValid(invalid), false);
const themeManifest = {
  name: '@porcelain/theme',
  private: true,
  type: 'module',
  exports: { './tokens.css': './src/tokens.css' },
};
deepStrictEqual(themeManifestValid(themeManifest), true);
deepStrictEqual(
  themeManifestValid({ ...themeManifest, dependencies: { react: '*' } }),
  false,
);
deepStrictEqual(
  themeManifestValid({ ...themeManifest, scripts: { typecheck: 'true' } }),
  false,
);
const metroFixture =
  "const { getDefaultConfig } = require('expo/metro-config'); const { withUniwindConfig } = require('uniwind/metro'); module.exports = withUniwindConfig(getDefaultConfig(__dirname), { cssEntryFile: './src/app.css', dtsFile: './src/config/uniwind-types.d.ts', });";
deepStrictEqual(mobileMetroValid(metroFixture), true);
deepStrictEqual(
  mobileMetroValid(metroFixture.replace('./src/app.css', './src/other.css')),
  false,
);
deepStrictEqual(
  mobileMetroValid(metroFixture.replace('uniwind/metro', 'uni wind/metro')),
  false,
);
deepStrictEqual(mobileMetroValid(`${metroFixture} require('node:fs');`), false);
const nativeCssFixture =
  "@import 'tailwindcss'; @import 'uniwind'; @import '@porcelain/theme/tokens.css';";
deepStrictEqual(mobileStylesValid(nativeCssFixture), true);
deepStrictEqual(
  mobileStylesValid(
    `${nativeCssFixture} @theme inline { --font-sans: system-ui; }`,
  ),
  true,
);
deepStrictEqual(
  mobileStylesValid(`${nativeCssFixture} @import 'another-ui-library';`),
  false,
);
deepStrictEqual(
  mobileStylesValid(`${nativeCssFixture} .button { color: red; }`),
  false,
);
const generatedFixture = `// NOTE: This file is generated by uniwind and it should not be edited manually.
/// <reference types="uniwind/types" />
declare module 'uniwind' { export interface UniwindConfig { themes: readonly ['light', 'dark'] } } export {}`;
deepStrictEqual(mobileGeneratedTypesValid(generatedFixture), true);
deepStrictEqual(
  mobileGeneratedTypesValid(
    generatedFixture.replace("'dark'", "'dark', 'arbitrary'"),
  ),
  false,
);
deepStrictEqual(
  mobileGeneratedTypesValid(`${generatedFixture} export const escaped: any;`),
  false,
);
process.stdout.write(
  'PASS CSS-only theme ownership and native styling configuration\n',
);
