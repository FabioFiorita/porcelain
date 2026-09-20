/**
 * Both modes of the runner start from the caller's environment with every
 * `GIT_*` variable that changes what Git reads removed, so a variable set for
 * the agent's own Git can never redirect Porcelain's.
 */
export function baseGitEnvironment(): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
    ),
    GIT_OPTIONAL_LOCKS: '0',
    GIT_CONFIG_COUNT: '0',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_NO_LAZY_FETCH: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
}
