import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export async function readInProgress(checkout: string): Promise<{
  inProgress: 'merge' | 'rebase' | null;
  mergeHeadOid: string | null;
}> {
  const dotGit = join(checkout, '.git');
  const stat = await lstat(dotGit);
  let gitDirectory = dotGit;
  if (stat.isFile()) {
    const marker = await readFile(dotGit, 'utf8');
    const match = marker.match(/^gitdir: ([^\0\r\n]+)\r?\n?$/);
    if (!match?.[1]) return { inProgress: null, mergeHeadOid: null };
    gitDirectory = isAbsolute(match[1])
      ? match[1]
      : resolve(dirname(dotGit), match[1]);
  }
  gitDirectory = await realpath(gitDirectory);
  if (
    (await exists(join(gitDirectory, 'rebase-merge'))) ||
    (await exists(join(gitDirectory, 'rebase-apply')))
  )
    return { inProgress: 'rebase', mergeHeadOid: null };
  const mergeHead = await readFile(
    join(gitDirectory, 'MERGE_HEAD'),
    'utf8',
  ).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return null;
    throw error;
  });
  if (mergeHead === null) return { inProgress: null, mergeHeadOid: null };
  const oids = mergeHead.trimEnd().split('\n');
  return {
    inProgress: 'merge',
    mergeHeadOid:
      oids.length === 1 && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(oids[0] ?? '')
        ? (oids[0] ?? null)
        : null,
  };
}

async function exists(path: string) {
  return lstat(path).then(
    () => true,
    (error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return false;
      throw error;
    },
  );
}
