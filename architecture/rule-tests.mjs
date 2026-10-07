import { fileURLToPath } from 'node:url';
import { deepStrictEqual, throws, ok } from 'node:assert/strict';
import { RuleTester } from 'oxlint/plugins-dev';
import { parseSync } from 'oxc-parser';
import plugin from './oxlint-plugin.mjs';
import { runGuardrailCases } from './guardrail-tests.mjs';

import ruleCases from './rule-cases.mjs';
import { runBoundaryCases } from './boundary-tests.mjs';
await runBoundaryCases();
if (process.argv.includes('--boundaries')) process.exit(0);
import { readFileSync } from 'node:fs';
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
