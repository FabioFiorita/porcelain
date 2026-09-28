import { fileURLToPath } from 'node:url';
import { deepStrictEqual, throws } from 'node:assert/strict';
import { RuleTester } from 'oxlint/plugins-dev';
import plugin from './oxlint-plugin.mjs';
import ruleCases from './rule-cases.mjs';
import { manualAuditProblems } from './ci-policy.ts';
import { preflightEdits } from './probe-edits.ts';
import { settleBaseline } from './baseline.ts';

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
const held = 'apps/web/src/features/files/views/held.tsx';
const rule = 'porcelain/web-no-empty-catch';
const settled = (files) =>
  settleBaseline(
    { baseline: { [rule]: { [held]: 2 } }, problems: [] },
    (name) => name.includes('/'),
    Object.entries(files).flatMap(([file, count]) =>
      Array.from({ length: count }, () => ({ rule, file })),
    ),
  );
const summary = ({ reported, held: count, problems }) => ({
  reported: reported.length,
  held: count,
  problems: problems.map((found) => /holds|down to|is fixed/.exec(found)?.[0]),
});
deepStrictEqual(summary(settled({ [held]: 2 })), {
  reported: 0,
  held: 2,
  problems: [],
});
deepStrictEqual(summary(settled({ [held]: 3 })), {
  reported: 3,
  held: 0,
  problems: ['holds'],
});
deepStrictEqual(summary(settled({ [held]: 1 })), {
  reported: 0,
  held: 1,
  problems: ['down to'],
});
deepStrictEqual(summary(settled({})), {
  reported: 0,
  held: 0,
  problems: ['is fixed'],
});
deepStrictEqual(
  summary(
    settled({
      [held]: 2,
      'apps/web/src/features/files/views/new.tsx': 1,
      'packages/files/src/services/list.ts': 1,
    }),
  ),
  { reported: 2, held: 2, problems: [] },
);
process.stdout.write('PASS shrink-only baseline settlement\n');
