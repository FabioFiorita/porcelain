import { readFileSync } from 'node:fs';
import { z } from 'zod';

const pendingSchema = z.record(
  z.string(),
  z.record(z.string(), z.record(z.string(), z.number().int().positive())),
);

export type Pending = z.output<typeof pendingSchema>;
export type Located = { rule: string; file: string; message: string };
export type Settled<T extends Located> = {
  reported: T[];
  held: number;
  problems: string[];
};

export function readPending(path: string): Pending {
  return pendingSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

const separator = '\u0000';

export function settlePending<T extends Located>(
  pending: Pending,
  owns: (rule: string) => boolean,
  findings: readonly T[],
): Settled<T> {
  const groups = new Map<string, T[]>();
  for (const finding of findings) {
    const key = [finding.rule, finding.file, finding.message].join(separator);
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  const reported: T[] = [];
  const problems: string[] = [];
  let held = 0;
  for (const [key, group] of groups) {
    const [rule = '', file = '', message = ''] = key.split(separator);
    const allowed = pending[rule]?.[file]?.[message] ?? 0;
    if (group.length > allowed) {
      reported.push(...group);
      if (allowed > 0)
        problems.push(
          `${file}: ${group.length} ${rule} findings "${message}" where architecture/pending.json holds ${allowed}; fix the new ones.`,
        );
    } else held += group.length;
    if (group.length < allowed)
      problems.push(
        `${file}: ${rule} "${message}" is down to ${group.length}; lower architecture/pending.json to ${group.length}.`,
      );
  }
  for (const [rule, files] of Object.entries(pending))
    if (owns(rule))
      for (const [file, messages] of Object.entries(files))
        for (const message of Object.keys(messages))
          if (!groups.has([rule, file, message].join(separator)))
            problems.push(
              `${file}: ${rule} "${message}" is fixed; remove it from architecture/pending.json.`,
            );
  return { reported, held, problems };
}
