import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Schema } from 'effect';
import {
  archRuleFamilies,
  archRuleFamily,
  archRules,
  styleRules,
} from './policy.ts';

const repositoryPath = Schema.NonEmptyString.check(
  Schema.makeFilter(
    (path) => !isAbsolute(path) && !path.split('/').includes('..'),
    { expected: 'a probe edits a path inside the repository' },
  ),
);

const probeEditSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literals(['create', 'append', 'prepend']),
    path: repositoryPath,
    content: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal('replace'),
    path: repositoryPath,
    old: Schema.NonEmptyString,
    new: Schema.String,
    all: Schema.optional(Schema.Literal(true)),
  }),
  Schema.Struct({ kind: Schema.Literal('delete'), path: repositoryPath }),
]);

export const probeGates = [
  'lint',
  'web-lint',
  'arch',
  'typecheck',
  'test',
  'db',
  'integration',
  'perf',
  'web-verify',
  'features',
] as const;

export type ProbeGate = (typeof probeGates)[number];

export const ruleShapes: Readonly<
  Record<ProbeGate, { pattern: RegExp; shape: string }>
> = {
  lint: {
    pattern: /^(?:porcelain|typescript|style)\([a-z]+(?:-[a-z]+)*\)$/,
    shape:
      'porcelain(<plugin rule>), typescript(<rule>) or style(<rule>), as lint prints its code',
  },
  'web-lint': {
    pattern: /^(?:porcelain|typescript|style|shadcn)\([a-z]+(?:-[a-z]+)*\)$/,
    shape:
      'porcelain(<plugin rule>), typescript(<rule>), shadcn(<rule>) or style(<rule>), as the web lint prints its code',
  },
  arch: {
    pattern: /^[a-z]+(?:-[a-z]+)*:$/,
    shape: '<arch rule>: as arch:check prints its count line',
  },
  typecheck: {
    pattern: /^error TS(?:\d{4}|377\d{3})$/,
    shape:
      'error TS<code>, as TypeScript or native Effect diagnostics print a diagnostic',
  },
  test: {
    pattern: /^(?:[A-Z][A-Za-z]*)?Error: \S.*$/,
    shape: '<Name>Error: <message>, as vitest prints a failed case',
  },
  db: {
    pattern:
      /^(?:Schema change without a migration|Migrated database differs|Migration outside the journal|Shipped migration edited|No shipped base): \S.*$/,
    shape:
      '<problem>: <detail>, as check-migrations.ts prints one problem per line',
  },
  integration: {
    pattern:
      /^(?:(?:[A-Z][A-Za-z]*)?Error: \S.*|[a-z0-9-]+\.integration\.ts > \S.*)$/,
    shape:
      '<Name>Error: <message> or <file>.integration.ts > <test name>, as vitest prints a failed integration test, or the route coverage check',
  },
  perf: {
    pattern: /^(?:[A-Z][A-Za-z]*)?Error: \S.*$/,
    shape: '<Name>Error: <message>, as vitest prints a route over its budget',
  },
  'web-verify': {
    pattern: /^[^:\s][^:\n]*: \S.*$/,
    shape:
      '<label>: <detail>, as Vitest Browser Mode or Playwright Test prints a failed test',
  },
  features: {
    pattern: /^\S[^\n]*: \S.*$/,
    shape:
      '<map file, route file or call site>: <reason>, as scripts/feature-maps.ts prints each problem',
  },
};

export const probeSchema = Schema.Struct({
  decision: Schema.NonEmptyString,
  plants: Schema.NonEmptyString,
  gate: Schema.Literals(probeGates),
  rule: Schema.NonEmptyString,
  feature: Schema.optional(Schema.NonEmptyString),
  edits: Schema.NonEmptyArray(probeEditSchema),
}).check(
  Schema.makeFilter((probe) => {
    const issues: Schema.FilterIssue[] = [];
    if (
      probe.feature !== undefined &&
      !['integration', 'web-verify'].includes(probe.gate)
    )
      issues.push({
        path: ['feature'],
        issue: 'Only integration and web-verify probes select a test file.',
      });
    const { pattern, shape } = ruleShapes[probe.gate];
    if (!pattern.test(probe.rule))
      issues.push({
        path: ['rule'],
        issue: `its rule is not what ${probe.gate} prints: ${shape}`,
      });
    return issues;
  }),
);

export type Probe = typeof probeSchema.Encoded;
export type ProbeEdit = typeof probeEditSchema.Type;
export type RuleFamily =
  | 'porcelain'
  | 'typescript'
  | 'shadcn'
  | 'style'
  | 'arch';
export type RuleNames = Readonly<Record<RuleFamily, readonly string[]>>;

export const lintPluginSchema = Schema.Struct({
  default: Schema.Struct({
    rules: Schema.Record(Schema.String, Schema.Unknown),
  }),
});
const lintRulesSchema = Schema.Struct({
  rules: Schema.Record(Schema.String, Schema.Unknown),
});

export async function liveRuleNames(root: string): Promise<RuleNames> {
  const plugin = Schema.decodeUnknownSync(lintPluginSchema)(
    await import(
      pathToFileURL(join(root, 'architecture', 'oxlint-plugin.mjs')).href
    ),
  );
  const lint = Schema.decodeUnknownSync(lintRulesSchema)(
    JSON.parse(readFileSync(join(root, '.oxlintrc.json'), 'utf8')),
  );
  const sorted = (names: readonly string[]) =>
    names.toSorted((left, right) => left.localeCompare(right));
  return {
    porcelain: sorted(Object.keys(plugin.default.rules)),
    typescript: sorted(
      Object.keys(lint.rules)
        .filter((name) => name.startsWith('typescript/'))
        .map((name) => name.slice('typescript/'.length)),
    ),
    shadcn: sorted(
      Object.keys(lint.rules)
        .filter((name) => name.startsWith('shadcn/'))
        .map((name) => name.slice('shadcn/'.length)),
    ),
    style: sorted(styleRules),
    arch: sorted([...archRules, ...archRuleFamilies]),
  };
}

function namedRule(
  gate: ProbeGate,
  rule: string,
): { family: RuleFamily; name: string } | undefined {
  if (gate === 'arch') {
    const name = rule.slice(0, -1);
    return { family: 'arch', name: archRuleFamily(name) ?? name };
  }
  if (gate !== 'lint' && gate !== 'web-lint') return undefined;
  const match = /^(porcelain|typescript|shadcn|style)\((.+)\)$/.exec(rule);
  const family = match?.[1];
  if (
    family !== 'porcelain' &&
    family !== 'typescript' &&
    family !== 'shadcn' &&
    family !== 'style'
  )
    return undefined;
  return { family, name: match?.[2] ?? '' };
}

export function unknownRule(
  probe: Pick<Probe, 'gate' | 'rule'>,
  names: RuleNames,
): string | undefined {
  const named = namedRule(probe.gate, probe.rule);
  if (named === undefined || names[named.family].includes(named.name))
    return undefined;
  return `${probe.rule} names no ${named.family} rule the gates define; a probe proves a rule that exists`;
}
