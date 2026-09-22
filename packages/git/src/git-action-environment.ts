import { baseGitEnvironment } from './git-environment.ts';

/**
 * The shared environment plus the settings only a write needs: an action may
 * reach the network or start a hook, and must never stop for a prompt.
 */
export function gitActionEnvironment(): NodeJS.ProcessEnv {
  return {
    ...baseGitEnvironment(),
    GIT_SSH_COMMAND:
      'ssh -oBatchMode=yes -oStrictHostKeyChecking=yes -oNumberOfPasswordPrompts=0',
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
