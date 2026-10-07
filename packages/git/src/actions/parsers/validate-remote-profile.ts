import { Effect } from 'effect';
import { isAbsolute } from 'node:path';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';

const SCP_LIKE = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+:[^\s]+$/u;

export const validateRemoteProfile = Effect.fn('Git.validateRemoteProfile')(
  function* (url: string) {
    if (isAbsolute(url)) return 'local repository';
    if (SCP_LIKE.test(url)) return url;
    const parsed = yield* Effect.try({
      try: () => new URL(url),
      catch: (cause) => unsupportedRemote({ cause }),
    });
    if (
      !['https:', 'ssh:'].includes(parsed.protocol) ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      (parsed.protocol === 'https:' && parsed.username)
    )
      return yield* unsupportedRemote();
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  },
);

function unsupportedRemote(options?: ErrorOptions): GitActionRejectedError {
  return new GitActionRejectedError({
    reason: 'UNSUPPORTED_CONFIGURATION',
    ...options,
    detail:
      'The remote URL is not one Porcelain can use. It supports a local path, SSH, and HTTPS without a user name, password or query in the URL. Change it with `git remote set-url`, or run this action from a terminal.',
  });
}
