import { strictEqual } from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { RuleTester } from 'oxlint/plugins-dev';
import plugin from './oxlint-plugin.mjs';
import ruleCases from './rule-cases.mjs';
import { runBoundaryCases, runGuardrailCases } from './guardrail-tests.mjs';

const requested = process.argv.slice(2);
const all = requested.length === 0;
const group = (name) => all || requested.includes(name);
const cases = ruleCases.filter(
  (entry) => group('--lint') || requested.includes(entry.rule),
);
const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'tsx' } },
});
const root = fileURLToPath(new URL('../', import.meta.url));
for (const entry of cases) {
  strictEqual(plugin.rules[entry.rule] !== undefined, true, entry.rule);
  tester.run(entry.rule, plugin.rules[entry.rule], {
    valid: [
      { filename: root + (entry.validPath ?? entry.path), code: entry.valid },
    ],
    invalid: [
      {
        filename: root + entry.path,
        code: entry.invalid,
        errors: entry.errors,
      },
    ],
  });
}
const typed = group('--types') ? runGuardrailCases() : 0;
const boundaries = group('--boundaries') ? runBoundaryCases() : 0;
strictEqual(
  cases.length + typed + boundaries > 0,
  true,
  'Name an existing fixture group or lint rule.',
);
process.stdout.write(
  `Rule fixtures: ${cases.length} lint pairs, ${typed} typed ownership pairs, ${boundaries} boundary pairs.\n`,
);
