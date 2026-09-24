import { readFileSync } from 'node:fs';
import { z } from 'zod';

const pendingSchema = z.record(
  z.string(),
  z.record(z.string(), z.number().int().positive()),
);

export type Pending = z.output<typeof pendingSchema>;
export type Located = { rule: string; file: string };
export type Settled<T extends Located> = {
  reported: T[];
  held: number;
  problems: string[];
};

export function readPending(path: string): Pending {
  return pendingSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

export function settlePending<T extends Located>(
  pending: Pending,
  owns: (rule: string) => boolean,
  findings: readonly T[],
): Settled<T> {
  const groups = new Map<string, T[]>();
  for (const finding of findings) {
    const key = `${finding.rule}\u0000${finding.file}`;
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  const reported: T[] = [];
  const problems: string[] = [];
  let held = 0;
  for (const [key, group] of groups) {
    const [rule = '', file = ''] = key.split('\u0000');
    const allowed = pending[rule]?.[file] ?? 0;
    if (group.length > allowed) {
      reported.push(...group);
      if (allowed > 0)
        problems.push(
          `${file}: ${group.length} ${rule} findings where architecture/pending.json holds ${allowed}; fix the new ones.`,
        );
    } else held += group.length;
    if (group.length < allowed)
      problems.push(
        `${file}: ${rule} is down to ${group.length}; lower architecture/pending.json to ${group.length}.`,
      );
  }
  for (const [rule, files] of Object.entries(pending))
    if (owns(rule))
      for (const file of Object.keys(files))
        if (!groups.has(`${rule}\u0000${file}`))
          problems.push(
            `${file}: ${rule} is fixed; remove it from architecture/pending.json.`,
          );
  return { reported, held, problems };
}
