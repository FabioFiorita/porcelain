import { createHash } from 'node:crypto';
import type {
  GitChange,
  GitOrdinaryChange,
  GitStatusObservation,
} from '../dtos/git-status.ts';
import { InspectionLimitError } from '../errors/inspection-limit-error.ts';
import { InvalidGitStatusError } from '../errors/invalid-git-status-error.ts';
import { UnsupportedPathEncodingError } from '../errors/unsupported-path-encoding-error.ts';

function decode(output: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(output);
  } catch (cause) {
    throw new UnsupportedPathEncodingError({ cause });
  }
}

function path(value: string | undefined): string {
  if (
    !value ||
    value.startsWith('/') ||
    value.length > 4096 ||
    value.split('/').some((part) => ['', '.', '..'].includes(part))
  ) {
    throw new UnsupportedPathEncodingError();
  }
  return value;
}

function ordinary(
  scope: 'staged' | 'unstaged',
  code: string,
  current: string,
  previous: string,
  oldMode: string,
  newMode: string,
  oldOid: string | null,
  newOid: string | null,
  submodule: boolean,
): GitOrdinaryChange[] {
  if (code === '.') return [];
  const kinds = {
    A: 'added',
    M: 'modified',
    D: 'deleted',
    R: 'renamed',
    T: 'type-changed',
  } as const;
  if (
    !(code in kinds) ||
    !/^[0-7]{6}$/.test(oldMode) ||
    !/^[0-7]{6}$/.test(newMode)
  )
    throw new InvalidGitStatusError();
  return [
    {
      scope,
      kind: kinds[code as keyof typeof kinds],
      oldPath: code === 'A' ? null : code === 'R' ? previous : current,
      newPath: code === 'D' ? null : current,
      oldMode,
      newMode,
      oldOid: empty(oldOid),
      newOid: empty(newOid),
      supported: !submodule && oldMode !== '160000' && newMode !== '160000',
    },
  ];
}

/** Git prints all zeroes where a side has no object. */
function empty(oid: string | null) {
  return !oid || /^0+$/.test(oid) ? null : oid;
}

function tracked(record: string, previous?: string): GitChange[] {
  const count = record.startsWith('2 ') ? 9 : 8;
  const fields = record.split(' ');
  const current = path(fields.slice(count).join(' '));
  const xy = fields[1] ?? '';
  const headMode = fields[3] ?? '';
  const indexMode = fields[4] ?? '';
  const workingMode = fields[5] ?? '';
  const headOid = fields[6] ?? '';
  const indexOid = fields[7] ?? '';
  if (xy.length !== 2) throw new InvalidGitStatusError();
  const submodule = fields[2]?.startsWith('S') ?? false;
  return [
    ...ordinary(
      'staged',
      xy[0] ?? '',
      current,
      previous ?? current,
      headMode,
      indexMode,
      headOid,
      indexOid,
      submodule,
    ),
    ...ordinary(
      'unstaged',
      xy[1] ?? '',
      current,
      previous ?? current,
      indexMode,
      workingMode,
      // The worktree side has no object id until something hashes it.
      indexOid,
      null,
      submodule,
    ),
  ];
}

function conflict(record: string): GitChange {
  const fields = record.split(' ');
  const code = fields[1];
  if (!code || !['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(code))
    throw new InvalidGitStatusError();
  const modes = fields.slice(3, 7);
  const oids = fields.slice(7, 10);
  if (
    modes.length !== 4 ||
    modes.some((mode) => !/^[0-7]{6}$/.test(mode)) ||
    oids.length !== 3 ||
    oids.some((oid) => !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(oid))
  )
    throw new InvalidGitStatusError();
  return {
    scope: 'unmerged',
    path: path(fields.slice(10).join(' ')),
    conflict: code as 'DD' | 'AU' | 'UD' | 'UA' | 'DU' | 'AA' | 'UU',
    modes: modes as [string, string, string, string],
    oids: oids as [string, string, string],
  };
}

function headOid(records: string[]): string | null {
  const head = records
    .find((record) => record.startsWith('# branch.oid '))
    ?.slice(13);
  if (
    !head ||
    (head !== '(initial)' && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head))
  )
    throw new InvalidGitStatusError();
  return head === '(initial)' ? null : head;
}

export function parseGitStatus(output: Buffer): GitStatusObservation {
  const text = decode(output);
  if (!text.endsWith('\0')) throw new InvalidGitStatusError();
  const records = text.slice(0, -1).split('\0');
  const iterator = records[Symbol.iterator]();
  const changes: GitChange[] = [];
  const head = headOid(records);
  for (const record of iterator) {
    if (record.startsWith('# ')) continue;
    if (record.startsWith('1 ')) changes.push(...tracked(record));
    else if (record.startsWith('2 '))
      changes.push(...tracked(record, path(iterator.next().value)));
    else if (record.startsWith('? '))
      // Git keeps a trailing directory marker for untracked nested repositories.
      changes.push({
        scope: 'untracked',
        path: path(record.slice(2).replace(/\/$/, '')),
      });
    else if (record.startsWith('u ')) changes.push(conflict(record));
    else throw new InvalidGitStatusError();
    if (changes.length > 2000) throw new InspectionLimitError();
  }
  return {
    statusToken: createHash('sha256').update(output).digest('hex'),
    headOid: head,
    ...(records.some((record) => record.startsWith('# branch.head '))
      ? {
          branch: {
            name:
              records
                .find((record) => record.startsWith('# branch.head '))
                ?.slice(14) === '(detached)'
                ? null
                : (records
                    .find((record) => record.startsWith('# branch.head '))
                    ?.slice(14) ?? null),
            upstream:
              records
                .find((record) => record.startsWith('# branch.upstream '))
                ?.slice(18) ?? null,
            ahead: Number(
              records
                .find((record) => record.startsWith('# branch.ab '))
                ?.match(/\+(\d+)/)?.[1] ?? 0,
            ),
            behind: Number(
              records
                .find((record) => record.startsWith('# branch.ab '))
                ?.match(/-(\d+)/)?.[1] ?? 0,
            ),
          },
        }
      : {}),
    changes,
  };
}
