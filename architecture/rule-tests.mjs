import { fileURLToPath } from 'node:url';
import { deepStrictEqual, throws } from 'node:assert/strict';
import { RuleTester } from 'oxlint/plugins-dev';
import plugin from './oxlint-plugin.mjs';
import { manualAuditProblems } from './ci-policy.ts';
import { preflightEdits } from './probe-edits.ts';

const root = new URL('../', import.meta.url);
const filename = fileURLToPath(
  new URL('apps/web/src/features/files/views/rule-fixture.tsx', root),
);
const adapter = fileURLToPath(
  new URL('apps/web/src/features/files/adapters/rule-fixture.tsx', root),
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
    rule: 'web-no-use-state',
    valid: "export function title() { return 'File'; }",
    invalid:
      "import { useState } from 'react'; export function draft() { return useState(''); }",
    message:
      '`useState` is not ours here: server data is Query, drafts are TanStack Form, client state is the feature store.ts, overlays are Base UI handles.',
  },
  {
    rule: 'web-views-no-loops',
    valid:
      'export function labels(names: string[]) { return names.map(name => name); }',
    invalid:
      'export function labels(names: string[]) { const labels: string[] = []; for (const name of names) labels.push(name); return labels; }',
    message:
      'A view only loops to render: map, filter, some and find shape what it shows; a write over many items is one command in commands/ that takes the list.',
  },
  {
    rule: 'web-no-module-mutable-binding',
    valid: 'export const count = 0;',
    invalid: 'export let count = 0;',
    message:
      'Module-level mutable bindings bypass subscribers; put client state and counters in the feature store.ts.',
  },
  {
    rule: 'web-no-use-reducer',
    valid: 'export const count = 0;',
    invalid:
      "import { useReducer as reducer } from 'react'; export const draft = () => reducer(() => 0, 0);",
    message:
      '`useReducer` is not ours here: state that changes by action lives in the feature store.ts, where every view reads the same copy.',
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
    rule: 'web-effects-in-adapters',
    allowed: adapter,
    valid:
      "import { useEffect } from 'react'; export const mount = () => useEffect(() => {}, []);",
    invalid:
      "import { useEffect } from 'react'; export const mount = () => useEffect(() => {}, []);",
    message:
      '`useEffect` belongs to features/<domain>/adapters/, the imperative glue for Pierre and the editor; data arrives through Query, commands and live.ts, never through an effect.',
  },
  {
    rule: 'web-refs-in-adapters',
    allowed: adapter,
    valid:
      "import { useRef } from 'react'; export const handle = () => useRef(null);",
    invalid:
      "import { useRef } from 'react'; export const handle = () => useRef(null);",
    message:
      '`useRef` belongs to features/<domain>/adapters/, where imperative library glue holds its DOM handles; a view renders data and forwards events.',
  },
  {
    rule: 'web-views-no-jsx-refs',
    valid: 'export const View = () => <div>File</div>;',
    invalid: 'export const View = () => <div ref={() => {}}>File</div>;',
    message:
      'A view renders data and forwards events; move a DOM ref and its element into an adapter component, including callback refs.',
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
for (const entry of cases) {
  tester.run(entry.rule, plugin.rules[entry.rule], {
    valid: [{ filename: entry.allowed ?? filename, code: entry.valid }],
    invalid: [
      { filename, code: entry.invalid, errors: [{ message: entry.message }] },
    ],
  });
  process.stdout.write(`PASS ${entry.rule}: valid and invalid fixtures\n`);
}
process.stdout.write(
  `Rule fixtures: ${Math.round(performance.now() - started)} ms.\n`,
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
