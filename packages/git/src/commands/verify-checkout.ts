import { stat } from 'node:fs/promises';
import { RepositoryIdentityMismatchError } from '../errors/repository-identity-mismatch-error.ts';
import { executeInspection } from '../execute-inspection.ts';

export async function verifyCheckout(
  checkout: string,
  expectedIdentity: string,
  expectedRepositoryIdentity: string,
  signal?: AbortSignal,
): Promise<void> {
  const output = await executeInspection(
    checkout,
    ['rev-parse', '--absolute-git-dir'],
    16384,
    signal,
  );
  const directory = new TextDecoder('utf-8', { fatal: true })
    .decode(output)
    .slice(0, -1);
  const info = await stat(directory, { bigint: true });
  signal?.throwIfAborted();
  if (`${info.dev}:${info.ino}:${info.birthtimeNs}` !== expectedIdentity) {
    throw new RepositoryIdentityMismatchError();
  }
  const common = await executeInspection(
    checkout,
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    16384,
    signal,
  );
  const commonDirectory = new TextDecoder('utf-8', { fatal: true })
    .decode(common)
    .slice(0, -1);
  const repository = await stat(commonDirectory, { bigint: true });
  signal?.throwIfAborted();
  if (
    `${repository.dev}:${repository.ino}:${repository.birthtimeNs}` !==
    expectedRepositoryIdentity
  ) {
    throw new RepositoryIdentityMismatchError();
  }
}
