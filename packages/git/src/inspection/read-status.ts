import { InspectionLimitError } from './errors/inspection-limit-error.ts';
import { readInProgress } from './helpers/read-in-progress.ts';
import type { CheckoutSession } from './interfaces/git-session.ts';
import { parseGitStatus } from './parse-git-status.ts';
import { runInspection } from './read-inspection.ts';
import { sessionConversionFilters } from './commands/check-conversion-filters.ts';

export async function readStatus(
  session: CheckoutSession,
  signal?: AbortSignal,
) {
  const checkout = session.path;
  const config = await sessionConversionFilters(session, signal);
  const [output, operation] = await Promise.all([
    runInspection(
      checkout,
      [
        'status',
        '--porcelain=v2',
        '-z',
        '--branch',
        '--ahead-behind',
        '--untracked-files=all',
        '--ignore-submodules=dirty',
        '--find-renames=50%',
      ],
      signal,
      { maxBytes: 8 * 1024 * 1024, config: config },
    ),
    readInProgress(checkout),
  ]);
  return { ...parseGitStatus(output), ...operation };
}

export async function readBranchDetails(
  session: CheckoutSession,
  branch: string | null,
  headOid: string | null,
  signal?: AbortSignal,
): Promise<{
  remoteName: string | null;
  sourceRef: string | null;
  upstreamOid: string | null;
  stashes: { oid: string; message: string }[];
  discarded: { oid: string; path: string; kind: 'hunk' | 'rename' }[];
  headCommit: { subject: string; body?: string } | null;
}> {
  const checkout = session.path;
  const tracking = branch
    ? (
        await runInspection(
          checkout,
          [
            'for-each-ref',
            '--format=%(refname)%00%(upstream:remotename)%00%(upstream:remoteref)%00%(upstream)',
            'refs/heads/',
          ],
          signal,
          { maxBytes: 1024 * 1024 },
        )
      )
        .toString('utf8')
        .split('\n')
        .map((line) => line.split('\0'))
        .find(([name]) => name === `refs/heads/${branch}`)
    : undefined;
  const stashes = (
    await runInspection(
      checkout,
      ['stash', 'list', '--format=%H%x00%gs', '-100'],
      signal,
      { maxBytes: 1024 * 1024 },
    )
  )
    .toString('utf8')
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [oid = '', message = ''] = line.split('\0');
      return { oid, message };
    });
  const headCommit = headOid
    ? parseHeadCommit(
        await runInspection(
          checkout,
          ['show', '-s', '--format=%s%x00%b', headOid],
          signal,
          { maxBytes: 64 * 1024 },
        ),
      )
    : null;
  return {
    remoteName: tracking?.[1] || null,
    sourceRef: tracking?.[2] || null,
    upstreamOid:
      tracking?.[1] && tracking[3]
        ? (
            await runInspection(
              checkout,
              ['rev-parse', '--verify', `${tracking[3]}^{commit}`],
              signal,
              { maxBytes: 1024 },
            )
          )
            .toString('utf8')
            .trimEnd() || null
        : null,
    stashes,
    discarded: await readDiscarded(checkout, signal),
    headCommit,
  };
}

async function readDiscarded(
  checkout: string,
  signal?: AbortSignal,
): Promise<{ oid: string; path: string; kind: 'hunk' | 'rename' }[]> {
  const listed = (
    await runInspection(
      checkout,
      [
        'for-each-ref',
        '--sort=-creatordate',
        '--count=50',
        '--format=%(objectname)%00%(refname)',
        'refs/porcelain/discarded/',
      ],
      signal,
      { maxBytes: 64 * 1024 },
    )
  )
    .toString('utf8')
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      const [oid = '', ref = ''] = line.split('\0');
      return /^[0-9a-f]{40}$/.test(oid) &&
        ref.startsWith('refs/porcelain/discarded/')
        ? [{ oid }]
        : [];
    });
  if (listed.length === 0) return [];
  let batch: Buffer;
  try {
    batch = await runInspection(checkout, ['cat-file', '--batch'], signal, {
      maxBytes: 4 * 1024 * 1024,
      input: Buffer.from(`${listed.map((entry) => entry.oid).join('\n')}\n`),
    });
  } catch (cause) {
    if (!(cause instanceof InspectionLimitError)) throw cause;
    return listed.map((entry) => ({
      oid: entry.oid,
      path: 'discarded change',
      kind: 'hunk' as const,
    }));
  }
  const bodies = readObjectBatch(
    batch,
    listed.map((entry) => entry.oid),
  );
  return listed.flatMap((entry) => {
    const body = bodies.get(entry.oid);
    if (body == null) return [];
    const described = describeDiscard(body);
    return described ? [{ oid: entry.oid, ...described }] : [];
  });
}

function readObjectBatch(output: Buffer, oids: readonly string[]) {
  const bodies = new Map<string, string>();
  let offset = 0;
  for (const oid of oids) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd < 0) break;
    const header = output.subarray(offset, headerEnd).toString('utf8');
    offset = headerEnd + 1;
    const missing = header.endsWith(' missing');
    if (missing) continue;
    const match = /^[0-9a-f]+ \w+ (\d+)$/.exec(header);
    if (!match?.[1]) break;
    const size = Number(match[1]);
    bodies.set(oid, output.subarray(offset, offset + size).toString('utf8'));
    offset += size + 1;
  }
  return bodies;
}

function describeDiscard(
  content: string,
): { path: string; kind: 'hunk' | 'rename' } | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'porcelainDiscard' in parsed &&
      parsed.porcelainDiscard === 1
    ) {
      const path =
        'path' in parsed && typeof parsed.path === 'string'
          ? parsed.path
          : pathFromDiff(
              `${'cached' in parsed && typeof parsed.cached === 'string' ? parsed.cached : ''}\n${'unstaged' in parsed && typeof parsed.unstaged === 'string' ? parsed.unstaged : ''}`,
            );
      if (!path) return null;
      return {
        path,
        kind: 'kind' in parsed && parsed.kind === 'rename' ? 'rename' : 'hunk',
      };
    }
  } catch {}
  const path = pathFromDiff(content);
  return path ? { path, kind: 'hunk' } : null;
}

function pathFromDiff(diff: string): string | null {
  const match = /^diff --git a\/(.+) b\/(.+)$/m.exec(diff);
  const path = match?.[2];
  if (
    !path ||
    path.includes(' ') ||
    path.startsWith('/') ||
    path.includes('..')
  )
    return null;
  return path;
}

function parseHeadCommit(output: Buffer) {
  const [subject = '', body = ''] = output
    .toString('utf8')
    .trimEnd()
    .split('\0');
  return { subject, ...(body ? { body } : {}) };
}
