import { baseGitEnvironment } from './git-environment.ts';

/**
 * The shared environment plus the settings only a write needs: an action may
 * reach the network or start a hook, and must never stop for a prompt.
 *
 * SSH is left to the owner's own setup, `core.sshCommand` or `~/.ssh/config`,
 * so an action authenticates the way every other Git client on the machine
 * does. It still cannot prompt: the runner starts Git in a new session, so
 * `ssh` has no terminal to open, and askpass is disabled. An unknown host key
 * or a missing credential fails instead of waiting.
 */
export function gitActionEnvironment(): NodeJS.ProcessEnv {
  return {
    ...baseGitEnvironment(),
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
