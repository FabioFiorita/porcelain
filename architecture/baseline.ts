import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export const baselineFile = 'architecture/web-baseline.json';

const baselineSchema = z.record(
  z.string().min(1),
  z.record(
    z.string().regex(/^apps\/web\//, 'the baseline holds web files only'),
    z.number().int().positive(),
  ),
);

export type Baseline = z.output<typeof baselineSchema>;
export type Located = { rule: string; file: string };
export type Settled<T extends Located> = {
  reported: T[];
  held: number;
  problems: string[];
};

export type Read = { baseline: Baseline; problems: string[] };

function parsed(text: string, where: string): Read {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return {
      baseline: {},
      problems: [
        `${where} is not strict JSON (${error instanceof Error ? error.message : String(error)}); it holds rule, web file and count only.`,
      ],
    };
  }
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

export function readBaseline(root: string): Read {
  const path = join(root, baselineFile);
  return existsSync(path)
    ? parsed(readFileSync(path, 'utf8'), baselineFile)
    : { baseline: {}, problems: [] };
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

function versionAt(root: string, commit: string): Baseline | undefined {
  const shown = git(root, ['show', `${commit}:${baselineFile}`]);
  return shown.status === 0
    ? parsed(shown.stdout, `${baselineFile} at ${commit.slice(0, 12)}`).baseline
    : undefined;
}

function raised(later: Baseline, earlier: Baseline): string[] {
  return Object.entries(later).flatMap(([rule, files]) =>
    Object.entries(files).flatMap(([file, count]) => {
      const before = earlier[rule]?.[file];
      if (before === undefined) return [`${rule} in ${file} (new entry)`];
      return count > before
        ? [`${rule} in ${file} (${before} to ${count})`]
        : [];
    }),
  );
}

export function baselineHistoryProblems(root: string): string[] {
  const shallow = git(root, ['rev-parse', '--is-shallow-repository']);
  if (shallow.stdout.trim() !== 'false')
    return [
      `${baselineFile} is checked against its whole history, and this clone is shallow; fetch the full history.`,
    ];
  const problems: string[] = [];
  const logged = git(root, [
    'log',
    '--full-history',
    '--format=%H %P',
    'HEAD',
    '--',
    baselineFile,
  ]);
  if (logged.status !== 0)
    return [`git log could not read the history of ${baselineFile}.`];
  let creations = 0;
  for (const line of logged.stdout.split('\n').filter(Boolean)) {
    const [commit = '', ...parents] = line.split(' ');
    const version = versionAt(root, commit);
    if (version === undefined) continue;
    const earlier = parents.flatMap((parent) => {
      const found = versionAt(root, parent);
      return found === undefined ? [] : [found];
    });
    if (earlier.length === 0) creations += 1;
    for (const before of earlier)
      for (const growth of raised(version, before))
        problems.push(
          `commit ${commit.slice(0, 12)} raised ${growth}; ${baselineFile} only loses entries or lowers counts.`,
        );
  }
  if (creations > 1)
    problems.push(
      `${baselineFile} was created ${creations} times in the history; it is created once and only shrinks until it is deleted.`,
    );
  const path = join(root, baselineFile);
  if (!existsSync(path)) return problems;
  const working = readBaseline(root).baseline;
  const committed = versionAt(root, 'HEAD');
  if (committed === undefined) {
    if (creations > 0)
      problems.push(
        `${baselineFile} is created again after its history deleted it; it only shrinks.`,
      );
    return problems;
  }
  for (const growth of raised(working, committed))
    problems.push(
      `${baselineFile} raises ${growth} above the committed baseline; it only loses entries or lowers counts.`,
    );
  return problems;
}
