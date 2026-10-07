import { fileURLToPath } from 'node:url';
import { deepStrictEqual, throws, ok } from 'node:assert/strict';
import { RuleTester } from 'oxlint/plugins-dev';
import { parseSync } from 'oxc-parser';
import plugin from './oxlint-plugin.mjs';
import { runGuardrailCases } from './guardrail-tests.mjs';

import ruleCases, { externalCases } from './rule-cases.mjs';
import { readFileSync } from 'node:fs';
import { preflightEdits } from './probe-edits.ts';
import { classify, violation, forbiddenExternal } from './policy.ts';
for (const entry of externalCases) {
  deepStrictEqual(forbiddenExternal(entry.role, entry.valid), false);
  deepStrictEqual(forbiddenExternal(entry.role, entry.invalid), true);
}
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
deepStrictEqual(
  classify('packages/client/src/shared/api/effect-client.spec.ts'),
  {
    role: 'client-transport-spec',
    owner: 'client',
  },
);
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
    { role: 'live', owner: 'reviews' },
    { role: 'client-transport-api', owner: 'client' },
  ),
  undefined,
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
for (const [path, role] of [
  [
    'packages/client/spec/integration/files.integration.ts',
    'client-integration-test',
  ],
  ['packages/client/spec/kit/connection.ts', 'client-test-kit'],
])
  deepStrictEqual(classify(path), { role, owner: 'client' });
for (const [role, expected] of [
  ['server-kit', undefined],
  ['bootstrap', 'client-imports-client-and-contracts-only'],
])
  deepStrictEqual(
    violation(
      { role: 'client-integration-test', owner: 'client' },
      { role, owner: 'server' },
    ),
    expected,
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
process.stdout.write('PASS read-only fixture preflight\n');

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
  undefined,
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

deepStrictEqual(
  violation(
    { role: 'gateway', owner: 'server' },
    { role: 'contract', owner: 'contracts' },
  ),
  undefined,
);
for (const owner of ['kernel', 'git', 'projects', 'reviews', 'access'])
  deepStrictEqual(
    violation(
      { role: 'gateway', owner: 'server' },
      { role: 'error-api', owner },
    ),
    ['kernel', 'git'].includes(owner)
      ? undefined
      : 'gateway-cannot-import-error-api',
  );
deepStrictEqual(
  violation(
    { role: 'client-transport-spec', owner: 'client' },
    { role: 'contract', owner: 'contracts' },
  ),
  undefined,
);

deepStrictEqual(
  violation(
    { role: 'gateway', owner: 'git' },
    { role: 'contract', owner: 'contracts' },
  ),
  'gateway-cannot-import-contract',
);
