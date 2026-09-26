import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export const baselineFile = 'architecture/web-baseline.json';
export const journeyBaselineFile = 'architecture/web-journey-baseline.json';

const baselineSchema = z.record(
  z.string().min(1),
  z.record(
    z.string().regex(/^apps\/web\//, 'the baseline holds web files only'),
    z.number().int().positive(),
  ),
);

const journeyBaselineSchema = z
  .array(
    z
      .string()
      .regex(
        /^(?:GET|POST|PUT|PATCH|DELETE) \/api\/\S*$/,
        'each entry is a server route the web calls, as <METHOD> /api/<path>',
      ),
  )
  .refine(
    (routes) => routes.every((route, index) => routes.indexOf(route) === index),
    'each route is listed once',
  );

const ruleListSchema = z.record(z.string(), z.array(z.string()));

export type Baseline = z.output<typeof baselineSchema>;
export type Located = { rule: string; file: string };
export type Settled<T extends Located> = {
  reported: T[];
  held: number;
  problems: string[];
};

export type Read = { baseline: Baseline; problems: string[] };

function strictJson(
  text: string,
  where: string,
): { json: unknown; problem?: string } {
  try {
    const json: unknown = JSON.parse(text);
    return { json };
  } catch (error) {
    return {
      json: undefined,
      problem: `${where} is not strict JSON (${error instanceof Error ? error.message : String(error)})`,
    };
  }
}

function parsed(text: string, where: string): Read {
  const { json, problem } = strictJson(text, where);
  if (problem !== undefined)
    return {
      baseline: {},
      problems: [`${problem}; it holds rule, web file and count only.`],
    };
  const read = baselineSchema.safeParse(json);
  return read.success
    ? { baseline: read.data, problems: [] }
    : {
        baseline: {},
        problems: [
          `${where} holds rule, web file and positive count only, so no server file can hide behind it: ${read.error.issues.map((issue) => issue.message).join('; ')}.`,
        ],
      };
}

function parsedRoutes(
  text: string,
  where: string,
): { routes: string[]; problems: string[] } {
  const { json, problem } = strictJson(text, where);
  if (problem !== undefined) return { routes: [], problems: [`${problem}.`] };
  const read = journeyBaselineSchema.safeParse(json);
  return read.success
    ? { routes: read.data, problems: [] }
    : {
        routes: [],
        problems: [
          `${where} lists the routes the web calls that no journey reaches yet: ${read.error.issues.map((issue) => issue.message).join('; ')}.`,
        ],
      };
}

export function readBaseline(root: string): Read {
  const path = join(root, baselineFile);
  return existsSync(path)
    ? parsed(readFileSync(path, 'utf8'), baselineFile)
    : { baseline: {}, problems: [] };
}

export function readJourneyBaseline(root: string): {
  routes: string[];
  problems: string[];
} {
  const path = join(root, journeyBaselineFile);
  return existsSync(path)
    ? parsedRoutes(readFileSync(path, 'utf8'), journeyBaselineFile)
    : { routes: [], problems: [] };
}

const separator = '\u0000';

export function settleBaseline<T extends Located>(
  { baseline, problems: unreadable }: Read,
  owns: (rule: string) => boolean,
  findings: readonly T[],
): Settled<T> {
  const groups = new Map<string, T[]>();
  const reported: T[] = [];
  for (const finding of findings) {
    if (!finding.file.startsWith('apps/web/')) {
      reported.push(finding);
      continue;
    }
    const key = [finding.rule, finding.file].join(separator);
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  const problems: string[] = [...unreadable];
  let held = 0;
  for (const [key, group] of groups) {
    const [rule = '', file = ''] = key.split(separator);
    const allowed = baseline[rule]?.[file] ?? 0;
    if (group.length > allowed) {
      reported.push(...group);
      if (allowed > 0)
        problems.push(
          `${file}: ${group.length} ${rule} findings where ${baselineFile} holds ${allowed}; the baseline only shrinks, so fix the new ones.`,
        );
      continue;
    }
    held += group.length;
    if (group.length < allowed)
      problems.push(
        `${file}: ${rule} is down to ${group.length}; write ${group.length} into ${baselineFile} so the fix cannot come back.`,
      );
  }
  for (const [rule, files] of Object.entries(baseline))
    if (owns(rule))
      for (const file of Object.keys(files))
        if (!groups.has([rule, file].join(separator)))
          problems.push(
            `${file}: ${rule} is fixed; remove it from ${baselineFile} so the fix cannot come back.`,
          );
  return { reported, held, problems };
}

function git(root: string, args: readonly string[]) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

type Units = Map<string, number>;

type ShrinkOnly = {
  file: string;
  units(text: string, where: string): Units;
  introduces(key: string, later: string, earlier: string): boolean;
};

function shown(root: string, commit: string, file: string) {
  if (commit === '')
    return existsSync(join(root, file))
      ? readFileSync(join(root, file), 'utf8')
      : undefined;
  const result = git(root, ['show', `${commit}:${file}`]);
  return result.status === 0 ? result.stdout : undefined;
}

function unitsAt(root: string, ledger: ShrinkOnly, commit: string) {
  const text = shown(root, commit, ledger.file);
  return text === undefined
    ? undefined
    : ledger.units(
        text,
        commit === ''
          ? ledger.file
          : `${ledger.file} at ${commit.slice(0, 12)}`,
      );
}

function grown(
  later: Units,
  earlier: Units,
  introduced: (key: string) => boolean,
): string[] {
  return [...later].flatMap(([key, count]) => {
    const before = earlier.get(key);
    if (before === undefined)
      return introduced(key) ? [] : [`${key} (new entry)`];
    return count > before ? [`${key} (${before} to ${count})`] : [];
  });
}

function shrinkOnlyProblems(root: string, ledger: ShrinkOnly): string[] {
  const shallow = git(root, ['rev-parse', '--is-shallow-repository']);
  if (shallow.stdout.trim() !== 'false')
    return [
      `${ledger.file} is checked against its whole history, and this clone is shallow; fetch the full history.`,
    ];
  const problems: string[] = [];
  const logged = git(root, [
    'log',
    '--full-history',
    '--format=%H %P',
    'HEAD',
    '--',
    ledger.file,
  ]);
  if (logged.status !== 0)
    return [`git log could not read the history of ${ledger.file}.`];
  let creations = 0;
  for (const line of logged.stdout.split('\n').filter(Boolean)) {
    const [commit = '', ...parents] = line.split(' ');
    const version = unitsAt(root, ledger, commit);
    if (version === undefined) continue;
    const earlier = parents.flatMap((parent) => {
      const found = unitsAt(root, ledger, parent);
      return found === undefined ? [] : [{ parent, found }];
    });
    if (earlier.length === 0) creations += 1;
    for (const { parent, found } of earlier)
      for (const growth of grown(version, found, (key) =>
        ledger.introduces(key, commit, parent),
      ))
        problems.push(
          `commit ${commit.slice(0, 12)} raised ${growth}; ${ledger.file} only loses entries or lowers counts.`,
        );
  }
  if (creations > 1)
    problems.push(
      `${ledger.file} was created ${creations} times in the history; it is created once and only shrinks until it is deleted.`,
    );
  const working = unitsAt(root, ledger, '');
  if (working === undefined) return problems;
  const committed = unitsAt(root, ledger, 'HEAD');
  if (committed === undefined) {
    if (creations > 0)
      problems.push(
        `${ledger.file} is created again after its history deleted it; it only shrinks.`,
      );
    return problems;
  }
  for (const growth of grown(working, committed, (key) =>
    ledger.introduces(key, '', 'HEAD'),
  ))
    problems.push(
      `${ledger.file} raises ${growth} above the committed baseline; it only loses entries or lowers counts.`,
    );
  return problems;
}

function listedRules(root: string, commit: string): Set<string> | undefined {
  const text = shown(root, commit, 'architecture/rules.json');
  if (text === undefined) return undefined;
  const read = ruleListSchema.safeParse(strictJson(text, commit).json);
  if (!read.success) return undefined;
  return new Set(
    Object.entries(read.data).flatMap(([family, names]) =>
      names.map((name) => (family === 'arch' ? name : `${family}/${name}`)),
    ),
  );
}

export function baselineHistoryProblems(root: string): string[] {
  return shrinkOnlyProblems(root, {
    file: baselineFile,
    units: (text, where) =>
      new Map(
        Object.entries(parsed(text, where).baseline).flatMap(([rule, files]) =>
          Object.entries(files).map(([file, count]): [string, number] => [
            `${rule} in ${file}`,
            count,
          ]),
        ),
      ),
    introduces(key, later, earlier) {
      const rule = key.split(' in ')[0] ?? '';
      const before = listedRules(root, earlier);
      return (
        before !== undefined &&
        !before.has(rule) &&
        listedRules(root, later)?.has(rule) === true
      );
    },
  });
}

export function journeyBaselineHistoryProblems(root: string): string[] {
  return shrinkOnlyProblems(root, {
    file: journeyBaselineFile,
    units: (text, where) =>
      new Map(
        parsedRoutes(text, where).routes.map((route): [string, number] => [
          route,
          1,
        ]),
      ),
    introduces: () => false,
  });
}
