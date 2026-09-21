import { baseGitEnvironment } from './git-environment.ts';
import { shellQuote } from './helpers/safe-ssh-command.ts';

/**
 * The shared environment plus the settings only a write needs: an action may
 * reach the network or start a hook, and must never stop for a prompt.
 *
 * `identity` is the one file a repository's `core.sshCommand` was allowed to
 * name. It is added to Porcelain's own SSH command, which still wins over the
 * repository setting.
 */
export function gitActionEnvironment(identity?: string): NodeJS.ProcessEnv {
  const identityArgs = identity
    ? ` -i ${shellQuote(identity)} -oIdentitiesOnly=yes`
    : '';
  return {
    ...baseGitEnvironment(),
    GIT_SSH_COMMAND: `ssh -oBatchMode=yes -oStrictHostKeyChecking=yes -oNumberOfPasswordPrompts=0${identityArgs}`,
    GCM_INTERACTIVE: 'never',
    GIT_ASKPASS: '/usr/bin/false',
    SSH_ASKPASS: '/usr/bin/false',
    SSH_ASKPASS_REQUIRE: 'never',
    GIT_EDITOR: '/usr/bin/false',
    GIT_SEQUENCE_EDITOR: '/usr/bin/false',
    LC_ALL: 'C',
    LANG: 'C',
  };
}
