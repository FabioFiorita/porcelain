import { lstat, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { readGitDirectory } from '../../shared/gitdir.ts';
import { isOid } from '../../shared/oid.ts';

type InProgress = {
  inProgress: 'merge' | 'rebase' | null;
  mergeHeadOid: string | null;
};

export async function readInProgress(checkout: string): Promise<InProgress> {
  const pointer = await readGitDirectory(checkout);
  if (pointer === undefined) return { inProgress: null, mergeHeadOid: null };
  const gitDirectory = await realpath(pointer);
  if (
    (await exists(join(gitDirectory, 'rebase-merge'))) ||
    (await exists(join(gitDirectory, 'rebase-apply')))
  )
    return { inProgress: 'rebase', mergeHeadOid: null };
  const mergeHead = await readFile(
    join(gitDirectory, 'MERGE_HEAD'),
    'utf8',
  ).catch((error: unknown) => {
    if (missing(error)) return undefined;
    throw error;
  });
  if (mergeHead === undefined) return { inProgress: null, mergeHeadOid: null };
  const oids = mergeHead.trimEnd().split('\n');
  const [oid] = oids;
  return {
    inProgress: 'merge',
    mergeHeadOid:
      oids.length === 1 && oid !== undefined && isOid(oid) ? oid : null,
  };
}

async function exists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    (error: unknown) => {
      if (missing(error)) return false;
      throw error;
    },
  );
}

function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
