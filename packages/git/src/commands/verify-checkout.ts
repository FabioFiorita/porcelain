import { stat } from 'node:fs/promises';
import { RepositoryIdentityMismatchError } from '../errors/repository-identity-mismatch-error.ts';
import { runInspection } from '../read-inspection.ts';

export async function verifyCheckout(
  checkout: string,
  expectedIdentity: string,
  expectedRepositoryIdentity: string,
  signal?: AbortSignal,
): Promise<void> {
  const output = await runInspection(
    checkout,
    ['rev-parse', '--absolute-git-dir'],
    signal,
    { maxBytes: 16384 },
  );
  const directory = new TextDecoder('utf-8', { fatal: true })
    .decode(output)
    .slice(0, -1);
  const info = await stat(directory, { bigint: true });
  signal?.throwIfAborted();
  if (`${info.dev}:${info.ino}:${info.birthtimeNs}` !== expectedIdentity) {
    throw new RepositoryIdentityMismatchError();
  }
  const common = await runInspection(
    checkout,
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    signal,
    { maxBytes: 16384 },
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
