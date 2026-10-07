import { Effect } from 'effect';
import { RepositoryIdentityMismatchError } from '../../shared/errors/repository-identity-mismatch-error.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { identity } from '../../shared/commands/identity.ts';
import { gitRead } from '../../shared/commands/run-git.ts';
import { InspectionLimitError } from '../../shared/errors/inspection-limit-error.ts';

export const verifyCheckoutEffect = Effect.fn('Git.verifyCheckout')(function* (
  checkout: string,
  expectedIdentity: string,
  expectedRepositoryIdentity: string,
  limits: GitLimits,
) {
  const directory = yield* readDirectory(
    checkout,
    ['rev-parse', '--absolute-git-dir'],
    limits,
  );
  if ((yield* identity(directory)) !== expectedIdentity)
    return yield* new RepositoryIdentityMismatchError();
  const commonDirectory = yield* readDirectory(
    checkout,
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    limits,
  );
  if ((yield* identity(commonDirectory)) !== expectedRepositoryIdentity)
    return yield* new RepositoryIdentityMismatchError();
});

const readDirectory = Effect.fn('Git.readCheckoutDirectory')(function* (
  checkout: string,
  args: readonly string[],
  limits: GitLimits,
) {
  const output = yield* gitRead(checkout, args, limits, {
    maxBytes: limits.inspection.checkoutDirectoryBytes,
  }).pipe(
    Effect.catchTag('GitOutputLimitError', (cause) =>
      Effect.fail(new InspectionLimitError({ cause })),
    ),
  );
  return new TextDecoder('utf-8', { fatal: true }).decode(output).slice(0, -1);
});
