import { Effect, Redacted, Schema } from 'effect';
import { runCommand } from '@porcelain/process';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';

class GitHubCommandError extends Schema.TaggedError<GitHubCommandError>()(
  'GitHubCommandError',
  {
    reason: Schema.Literals([
      'gh-not-installed',
      'no-access',
      'rate-limited',
      'offline',
      'invalid-response',
      'not-found',
    ]),
  },
) {}

const output = Effect.fn('Git.githubOutput')(function* (
  args: readonly string[],
  limits: GitLimits,
  token?: Redacted.Redacted<string>,
) {
  const env = { ...process.env };
  for (const name of [
    'GH_TOKEN',
    'GITHUB_TOKEN',
    'GH_ENTERPRISE_TOKEN',
    'GITHUB_ENTERPRISE_TOKEN',
    'GH_DEBUG',
    'GH_HOST',
    'GH_REPO',
  ])
    delete env[name];
  env.GH_PROMPT_DISABLED = '1';
  if (token !== undefined) env.GH_TOKEN = Redacted.value(token);
  const result = yield* runCommand({
    command: 'gh',
    args,
    env,
    maxBytes: Math.min(limits.outputBytes, 4 * 1024 * 1024),
    timeoutMs: limits.readTimeoutMs,
    processGroup: limits.processGroup,
  }).pipe(
    Effect.mapError(
      (error) =>
        new GitHubCommandError({
          reason:
            error.reason._tag === 'NotFound' ? 'gh-not-installed' : 'offline',
        }),
    ),
  );
  if (result.stopped === 'deadline' || !result.groupStopped)
    return yield* new GitHubCommandError({ reason: 'offline' });
  if (result.stopped === 'output-limit')
    return yield* new GitHubCommandError({ reason: 'invalid-response' });
  if (result.exitCode !== 0) {
    const message = result.stderr.toString('utf8').toLowerCase();
    const reason =
      message.includes('rate limit') ||
      message.includes('rate_limit') ||
      message.includes('http 429')
        ? 'rate-limited'
        : message.includes('could not resolve to a pullrequest')
          ? 'not-found'
          : message.includes('http 40') ||
              message.includes('could not resolve to a repository') ||
              message.includes('not logged')
            ? 'no-access'
            : 'offline';
    return yield* new GitHubCommandError({ reason });
  }
  const text = result.stdout.toString('utf8');
  if (token !== undefined && text.includes(Redacted.value(token)))
    return yield* new GitHubCommandError({ reason: 'invalid-response' });
  return text;
});

export const listGitHubAccounts = Effect.fn('Git.listGitHubAccounts')(
  function* (limits: GitLimits) {
    const text = yield* output(
      [
        'auth',
        'status',
        '--hostname',
        'github.com',
        '--json',
        'hosts',
        '--jq',
        '[.hosts["github.com"][]?.login]',
      ],
      limits,
    );
    return yield* Schema.decodeEffect(
      Schema.fromJsonString(Schema.Array(Schema.String)),
    )(text).pipe(
      Effect.map((accounts) => [...new Set(accounts)].sort()),
      Effect.mapError(
        () => new GitHubCommandError({ reason: 'invalid-response' }),
      ),
    );
  },
);

export const readGitHubApi = Effect.fn('Git.readGitHubApi')(function* (
  input: {
    account: string;
    endpoint: string;
    query?: string | undefined;
    variables?: Readonly<Record<string, string | number>> | undefined;
  },
  limits: GitLimits,
) {
  if (
    input.query !== undefined &&
    !input.query.trimStart().startsWith('query ')
  )
    return yield* new GitHubCommandError({ reason: 'invalid-response' });
  const token = Redacted.make(
    (yield* output(
      ['auth', 'token', '--hostname', 'github.com', '--user', input.account],
      limits,
    )).trim(),
  );
  if (Redacted.value(token) === '')
    return yield* new GitHubCommandError({ reason: 'no-access' });
  const args = ['api', '--hostname', 'github.com', input.endpoint];
  if (input.query === undefined) args.push('--method', 'GET');
  else {
    args.push('--method', 'POST', '-f', `query=${input.query}`);
    for (const [name, value] of Object.entries(input.variables ?? {}))
      args.push(typeof value === 'number' ? '-F' : '-f', `${name}=${value}`);
  }
  return yield* output(args, limits, token);
});
