import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import {
  archRuleFamilies,
  archRuleFamily,
  archRules,
  styleRules,
} from './policy.ts';

const repositoryPath = z
  .string()
  .min(1)
  .refine(
    (path) => !isAbsolute(path) && !path.split('/').includes('..'),
    'a probe edits a path inside the repository',
  );

const probeEditSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('create'),
    path: repositoryPath,
    content: z.string(),
  }),
  z.strictObject({
    kind: z.literal('append'),
    path: repositoryPath,
    content: z.string(),
  }),
  z.strictObject({
    kind: z.literal('prepend'),
    path: repositoryPath,
    content: z.string(),
  }),
  z.strictObject({
    kind: z.literal('replace'),
    path: repositoryPath,
    old: z.string().min(1),
    new: z.string(),
    all: z.literal(true).optional(),
  }),
  z.strictObject({
    kind: z.literal('delete'),
    path: repositoryPath,
  }),
]);

export const probeGates = [
  'lint',
  'arch',
  'typecheck',
  'test',
  'db',
  'verify',
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
  arch: {
    pattern: /^[a-z]+(?:-[a-z]+)*:$/,
    shape: '<arch rule>: as arch:check prints its count line',
  },
  typecheck: {
    pattern: /^error TS\d{4}$/,
    shape: 'error TS<code>, as tsc prints a diagnostic',
  },
  test: {
    pattern:
      /^(?:(?:[A-Z][A-Za-z]*)?Error: \S.*|\S.* (?:does not run as a plain case; every spec runs every time|ran no spec; a package that decides keeps its specs)\.)$/,
    shape:
      '<Name>Error: <message>, as vitest prints a failed case, or a line the spec-discipline reporter prints',
  },
  db: {
    pattern:
      /^(?:Schema change without a migration|Migrated database differs|Migration outside the journal|Shipped migration edited|No shipped base): \S.*$/,
    shape:
      '<problem>: <detail>, as check-migrations.ts prints one problem per line',
  },
  verify: {
    pattern: /^[^:\s][^:\n]*: \S.*$/,
    shape:
      '<case or net part>: <reason>, as the net prints each failure under its FAIL line',
  },
};

export const probeSchema = z
  .strictObject({
    decision: z.string().min(1),
    plants: z.string().min(1),
    gate: z.enum(probeGates),
    rule: z.string().min(1),
    feature: z.string().min(1).optional(),
    edits: z.array(probeEditSchema).min(1),
  })
  .superRefine((probe, context) => {
    if (probe.feature !== undefined && probe.gate !== 'verify')
      context.addIssue({
        code: 'custom',
        path: ['feature'],
        message: 'only a verify probe names the feature the net runs',
      });
    const { pattern, shape } = ruleShapes[probe.gate];
    if (!pattern.test(probe.rule))
      context.addIssue({
        code: 'custom',
        path: ['rule'],
        message: `its rule is not what ${probe.gate} prints: ${shape}`,
      });
  });

export type Probe = z.input<typeof probeSchema>;
export type ProbeEdit = z.output<typeof probeEditSchema>;

export type RuleFamily = 'porcelain' | 'typescript' | 'style' | 'arch';
export type RuleNames = Readonly<Record<RuleFamily, readonly string[]>>;

const pluginSchema = z.object({
  default: z.object({ rules: z.record(z.string(), z.unknown()) }),
});
const lintRulesSchema = z.object({
  rules: z.record(z.string(), z.unknown()),
});

export async function liveRuleNames(root: string): Promise<RuleNames> {
  const plugin = pluginSchema.parse(
    await import(
      pathToFileURL(join(root, 'architecture', 'oxlint-plugin.mjs')).href
    ),
  );
  const lint = lintRulesSchema.parse(
    JSON.parse(
      readFileSync(join(root, 'architecture', 'lint-config.json'), 'utf8'),
    ),
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
  if (gate !== 'lint') return undefined;
  const match = /^(porcelain|typescript|style)\((.+)\)$/.exec(rule);
  const family = match?.[1];
  if (family !== 'porcelain' && family !== 'typescript' && family !== 'style')
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

export function unprobedRules(
  probes: readonly Pick<Probe, 'gate' | 'rule'>[],
  names: RuleNames,
): string[] {
  const probed = new Set(
    probes.flatMap((probe) => {
      const named = namedRule(probe.gate, probe.rule);
      return named ? [`${named.family} ${named.name}`] : [];
    }),
  );
  return (['porcelain', 'typescript', 'style', 'arch'] as const).flatMap(
    (family) =>
      names[family]
        .filter((name) => !probed.has(`${family} ${name}`))
        .map((name) => (family === 'arch' ? `${name}:` : `${family}(${name})`)),
  );
}
