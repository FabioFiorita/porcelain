import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { domainPackages } from './policy.ts';
import { typeRuleFindings } from './type-rules.ts';
import { duplicateScope, scanDuplicates } from './duplicate-policy.ts';
import { selectorAppears } from './feature-selectors.ts';
import { guardrailCases } from './rule-cases.mjs';
import { apiCalls, sameRoute } from '../scripts/api-calls.ts';

function writeFiles(root, files) {
  for (const [name, source] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
}

function typeFixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-type-rules-'));
  try {
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

function clientRoutesFixture(entry, source) {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-client-routes-'));
  try {
    writeFiles(root, { ...entry.files, [entry.app]: source });
    const report = apiCalls(
      root,
      ['packages/client/src'],
      [/^packages\/client\/src\/features\/[^/]+\/api\.ts$/],
      [dirname(entry.app)],
    );
    deepStrictEqual(report.problems, []);
    for (const route of entry.mapped)
      strictEqual(
        report.calls.some((call) => sameRoute(route, call)),
        true,
        route,
      );
    return report.calls
      .filter((call) => !entry.mapped.some((route) => sameRoute(route, call)))
      .map((call) => `${call.method} ${call.path}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function duplicateFixture(entry, source) {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-clone-rule-'));
  try {
    const scope = {
      ...duplicateScope(entry.scope, ['reviews', 'client']),
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

function duplicateRatchetFixture(entry) {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-clone-ratchet-'));
  try {
    const scope = {
      ...duplicateScope('repository', ['reviews', 'client']),
      ceiling: entry.ceiling,
    };
    for (const folder of scope.sources)
      mkdirSync(join(root, folder), { recursive: true });
    const unique = Array.from(
      { length: 800 },
      (_, index) => `export const unique${index} = ${index};`,
    ).join('\n');
    writeFiles(root, {
      'apps/server/src/copy.ts': entry.source,
      'packages/reviews/src/copy.ts': entry.source,
      'packages/client/src/unique.ts': unique,
    });
    const before = scanDuplicates(root, scope);
    unlinkSync(join(root, 'packages/client/src/unique.ts'));
    const afterDeletion = scanDuplicates(root, scope);
    strictEqual(
      afterDeletion.statistics.total.percentage >
        before.statistics.total.percentage,
      true,
    );
    writeFiles(root, { 'apps/server/src/copy-again.ts': entry.source });
    const afterCopy = scanDuplicates(root, scope);
    const result = (report) => ({
      duplicatedLines: report.statistics.total.duplicatedLines,
      clones: report.statistics.total.clones,
      rejected: report.exceeded,
    });
    deepStrictEqual(
      { before: result(before), afterDeletion: result(afterDeletion) },
      entry.valid,
    );
    deepStrictEqual(result(afterCopy), entry.invalid);
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
    if (entry.rule === 'client-route-reachability') {
      deepStrictEqual(clientRoutesFixture(entry, entry.valid), [], entry.valid);
      deepStrictEqual(
        clientRoutesFixture(entry, entry.invalid),
        entry.errors,
        entry.invalid,
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
    } else if (entry.rule === 'duplicate-count-ratchet') {
      duplicateRatchetFixture(entry);
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
  deepStrictEqual(duplicateScope('web', []), {
    name: 'web',
    sources: ['apps/web/src'],
    metric: 'clones',
    ceiling: 0,
    why: 'Keep web logic in one owner so fixes cannot drift between copies.',
  });
  process.stdout.write(`PASS ${cases.length} guardrail fixtures\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  runGuardrailCases(process.argv.slice(2));
