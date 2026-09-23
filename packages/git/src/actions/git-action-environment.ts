import { baseGitEnvironment } from '../shared/git-environment.ts';

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
