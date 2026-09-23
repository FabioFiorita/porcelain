import { RepositoryIdentityMismatchError } from '../../discovery/index.ts';
import { identity } from '../../shared/identity.ts';
import { runInspection } from './run-inspection.ts';

export async function verifyCheckout(
  checkout: string,
  expectedIdentity: string,
  expectedRepositoryIdentity: string,
  signal?: AbortSignal,
): Promise<void> {
  const directory = await readDirectory(
    checkout,
    ['rev-parse', '--absolute-git-dir'],
    signal,
  );
  if ((await identity(directory)) !== expectedIdentity)
    throw new RepositoryIdentityMismatchError();
  signal?.throwIfAborted();
  const commonDirectory = await readDirectory(
    checkout,
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    signal,
  );
  if ((await identity(commonDirectory)) !== expectedRepositoryIdentity)
    throw new RepositoryIdentityMismatchError();
  signal?.throwIfAborted();
}

async function readDirectory(
  checkout: string,
  args: readonly string[],
  signal?: AbortSignal,
): Promise<string> {
  const output = await runInspection(checkout, args, signal, {
    maxBytes: 16384,
  });
  return new TextDecoder('utf-8', { fatal: true }).decode(output).slice(0, -1);
}
