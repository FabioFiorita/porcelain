import { lstat, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { isMissing } from '../../shared/errors/is-missing.ts';
import { readGitDirectory } from '../../shared/commands/gitdir.ts';
import { isOid } from '../../shared/parsers/oid.ts';

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
    if (isMissing(error)) return undefined;
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
      if (isMissing(error)) return false;
      throw error;
    },
  );
}
