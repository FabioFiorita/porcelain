import { createHash } from 'node:crypto';
import type {
  GitChange,
  GitConflictCode,
  GitOrdinaryChange,
  GitStatusObservation,
} from '../dtos/git-status.ts';
import { InvalidGitStatusError } from '../errors/invalid-git-status-error.ts';
import { UnsupportedPathEncodingError } from '../errors/unsupported-path-encoding-error.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { isNullOid, isOid } from '../../shared/oid.ts';

const MODE = /^[0-7]{6}$/u;
const CONFLICT_CODES: readonly GitConflictCode[] = [
  'DD',
  'AU',
  'UD',
  'UA',
  'DU',
  'AA',
  'UU',
];

type PathReader = (value: string | undefined) => string;

export function parseGitStatus(
  output: Buffer,
  limits: GitLimits,
): GitStatusObservation {
  const path = pathReader(limits.inspection.maxPathLength);
  const text = decode(output);
  if (!text.endsWith('\0')) throw new InvalidGitStatusError();
  const records = text.slice(0, -1).split('\0');
  const head = headOid(header(records, 'branch.oid'));
  const changes: GitChange[] = [];
  const iterator = records[Symbol.iterator]();
  for (const record of iterator) {
    if (record.startsWith('# ')) continue;
    if (record.startsWith('1 ')) changes.push(...tracked(record, path));
    else if (record.startsWith('2 '))
      changes.push(...tracked(record, path, path(iterator.next().value)));
    else if (record.startsWith('? '))
      changes.push({
        scope: 'untracked',
        path: path(record.slice(2).replace(/\/$/u, '')),
      });
    else if (record.startsWith('u ')) changes.push(conflict(record, path));
    else throw new InvalidGitStatusError();
  }
  const branch = header(records, 'branch.head');
  const counts = header(records, 'branch.ab');
  return {
    statusToken: createHash('sha256').update(output).digest('hex'),
    headOid: head,
    ...(branch === undefined
      ? {}
      : {
          branch: {
            name: branch === '(detached)' ? null : branch,
            upstream: header(records, 'branch.upstream') ?? null,
            ahead: Number(/\+(\d+)/u.exec(counts ?? '')?.[1] ?? 0),
            behind: Number(/-(\d+)/u.exec(counts ?? '')?.[1] ?? 0),
          },
        }),
    changes,
  };
}

function decode(output: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(output);
  } catch (cause) {
    throw new UnsupportedPathEncodingError({ cause });
  }
}

function header(records: readonly string[], name: string): string | undefined {
  const prefix = `# ${name} `;
  return records
    .find((record) => record.startsWith(prefix))
    ?.slice(prefix.length);
}

function headOid(value: string | undefined): string | null {
  if (value === '(initial)') return null;
  if (value === undefined || !isOid(value)) throw new InvalidGitStatusError();
  return value;
}

function pathReader(maxLength: number): PathReader {
  return (value) => {
    if (
      !value ||
      value.startsWith('/') ||
      value.length > maxLength ||
      value.split('/').some((part) => ['', '.', '..'].includes(part))
    )
      throw new UnsupportedPathEncodingError();
    return value;
  };
}

function ordinaryKind(code: string): GitOrdinaryChange['kind'] {
  switch (code) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'T':
      return 'type-changed';
    default:
      throw new InvalidGitStatusError();
  }
}

function ordinary(
  scope: 'staged' | 'unstaged',
  code: string,
  paths: { current: string; previous: string },
  modes: { old: string; new: string },
  oids: { old: string | null; new: string | null },
  submodule: boolean,
): GitOrdinaryChange[] {
  if (code === '.') return [];
  const kind = ordinaryKind(code);
  if (!MODE.test(modes.old) || !MODE.test(modes.new))
    throw new InvalidGitStatusError();
  return [
    {
      scope,
      kind,
      oldPath:
        kind === 'added'
          ? null
          : kind === 'renamed'
            ? paths.previous
            : paths.current,
      newPath: kind === 'deleted' ? null : paths.current,
      oldMode: modes.old,
      newMode: modes.new,
      oldOid: presentOid(oids.old),
      newOid: presentOid(oids.new),
      supported: !submodule && modes.old !== '160000' && modes.new !== '160000',
    },
  ];
}

function presentOid(oid: string | null): string | null {
  return !oid || isNullOid(oid) ? null : oid;
}

function tracked(
  record: string,
  path: PathReader,
  previous?: string,
): GitChange[] {
  const fields = record.split(' ');
  const current = path(fields.slice(record.startsWith('2 ') ? 9 : 8).join(' '));
  const [, xy = '', sub = '', headMode = '', indexMode = '', workMode = ''] =
    fields;
  const headOid = fields[6] ?? '';
  const indexOid = fields[7] ?? '';
  if (!/^..$/u.test(xy)) throw new InvalidGitStatusError();
  const paths = { current, previous: previous ?? current };
  const submodule = sub.startsWith('S');
  return [
    ...ordinary(
      'staged',
      xy.charAt(0),
      paths,
      { old: headMode, new: indexMode },
      { old: headOid, new: indexOid },
      submodule,
    ),
    ...ordinary(
      'unstaged',
      xy.charAt(1),
      paths,
      { old: indexMode, new: workMode },
      { old: indexOid, new: null },
      submodule,
    ),
  ];
}

function conflict(record: string, path: PathReader): GitChange {
  const fields = record.split(' ');
  const code = CONFLICT_CODES.find((candidate) => candidate === fields[1]);
  const [, , , first, second, third, work, base, ours, theirs] = fields;
  if (
    code === undefined ||
    first === undefined ||
    second === undefined ||
    third === undefined ||
    work === undefined ||
    base === undefined ||
    ours === undefined ||
    theirs === undefined ||
    ![first, second, third, work].every((mode) => MODE.test(mode)) ||
    ![base, ours, theirs].every(isOid)
  )
    throw new InvalidGitStatusError();
  return {
    scope: 'unmerged',
    path: path(fields.slice(10).join(' ')),
    conflict: code,
    modes: [first, second, third, work],
    oids: [base, ours, theirs],
  };
}
