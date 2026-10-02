import { fileURLToPath } from 'node:url';
import { deepStrictEqual, throws } from 'node:assert/strict';
import { RuleTester } from 'oxlint/plugins-dev';
import plugin from './oxlint-plugin.mjs';
import ruleCases from './rule-cases.mjs';
import { manualAuditProblems } from './ci-policy.ts';
import { preflightEdits } from './probe-edits.ts';
import { classify, violation } from './policy.ts';

const root = new URL('../', import.meta.url);
const filename = fileURLToPath(
  new URL('apps/web/src/features/files/views/rule-fixture.tsx', root),
);
const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'tsx' } },
});
const cases = [
  {
    rule: 'no-comments',
    valid: "export const label = 'File';",
    invalid: "// workaround\nexport const label = 'File';",
    message:
      'Remove the code comment; express the rule in code or architecture guidance.',
  },
  {
    rule: 'web-no-module-mutable-binding',
    valid: 'export const count = 0;',
    invalid: 'export let count = 0;',
    message:
      'Module-level mutable bindings bypass subscribers; put client state and counters in the feature store.ts.',
  },
  {
    rule: 'web-no-context',
    valid: 'export const count = 0;',
    invalid:
      "import * as React from 'react'; export const store = React.createContext(0);",
    message:
      '`createContext` is not ours here: shared client state is the feature store.ts and server data is Query; a provider hides who owns the value.',
  },
  {
    rule: 'web-no-manual-memo',
    valid: 'export const title = () => "File";',
    invalid:
      "import { useMemo } from 'react'; export const title = () => useMemo(() => 'File', []);",
    message:
      '`useMemo` is not ours here: the React Compiler memoizes every component; hand memoization hides what it cannot compile.',
  },
  {
    rule: 'web-views-no-await',
    valid: 'export const save = (command: () => void) => command();',
    invalid:
      'export const save = async (command: () => Promise<void>) => { await command(); };',
    message:
      'A view does not await: it calls a command hook and renders the command state; the async work lives in commands/.',
  },
  {
    rule: 'web-views-no-promise-chains',
    valid: 'export const save = (command: () => void) => command();',
    invalid:
      'export const save = (command: () => Promise<void>) => command().then(() => {});',
    message:
      'A view does not sequence promise completion: put success and error work in a command hook and let the view forward the event.',
  },
  {
    rule: 'web-views-no-try',
    valid: 'export const save = (command: () => void) => command();',
    invalid:
      'export const save = (command: () => void) => { try { command(); } catch {} };',
    message:
      'A view does not catch: a failed command reports through its hook state and the route error view; recovery lives in commands/.',
  },
];
const started = performance.now();
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
for (const entry of cases)
  tester.run(entry.rule, plugin.rules[entry.rule], {
    valid: [{ filename, code: entry.valid }],
    invalid: [
      { filename, code: entry.invalid, errors: [{ message: entry.message }] },
    ],
  });
for (const entry of ruleCases) {
  const at = fileURLToPath(new URL(entry.path, root));
  try {
    tester.run(entry.rule, plugin.rules[entry.rule], {
      valid:
        entry.valid === undefined ? [] : [{ filename: at, code: entry.valid }],
      invalid: [{ filename: at, code: entry.invalid, errors: entry.errors }],
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
    '.github/workflows/probes.yml: expensive audits run only on explicit workflow_dispatch.',
  ],
);
deepStrictEqual(
  manualAuditProblems(new Map([[path, { ...audit, jobs: {} }]])),
  ['Exactly one manual audit job runs the probe suite.'],
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
    '.github/workflows/probes.yml job probes: the manual audit shards plant every probe exactly once.',
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
    '.github/workflows/web.yml: expensive audits run only on explicit workflow_dispatch.',
  ],
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
