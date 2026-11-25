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

const invoke = Effect.fn('Git.githubInvoke')(function* (
  args: readonly string[],
  limits: GitLimits,
  token?: Redacted.Redacted<string>,
  stdin?: string,
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
    stdin,
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
  return result;
});

function failureReason(stderr: string) {
  const message = stderr.toLowerCase();
  if (
    message.includes('rate limit') ||
    message.includes('rate_limit') ||
    message.includes('http 429')
  )
    return 'rate-limited';
  if (message.includes('could not resolve to a pullrequest'))
    return 'not-found';
  if (
    message.includes('http 40') ||
    message.includes('could not resolve to a repository') ||
    message.includes('not logged')
  )
    return 'no-access';
  return 'offline';
}

const output = Effect.fn('Git.githubOutput')(function* (
  args: readonly string[],
  limits: GitLimits,
  token?: Redacted.Redacted<string>,
  stdin?: string,
) {
  const result = yield* invoke(args, limits, token, stdin);
  if (result.exitCode !== 0)
    return yield* new GitHubCommandError({
      reason: failureReason(result.stderr.toString('utf8')),
    });
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

const githubCommentSchema = Schema.fromJsonString(
  Schema.Struct({ html_url: Schema.String }),
);

const githubToken = Effect.fn('Git.githubToken')(function* (
  account: string,
  limits: GitLimits,
) {
  const value = (yield* output(
    ['auth', 'token', '--hostname', 'github.com', '--user', account],
    limits,
  )).trim();
  if (value === '')
    return yield* new GitHubCommandError({ reason: 'no-access' });
  return Redacted.make(value);
});

export const postGitHubIssueComment = Effect.fn('Git.postGitHubIssueComment')(
  function* (
    input: {
      account: string;
      owner: string;
      repo: string;
      number: number;
      body: string;
    },
    limits: GitLimits,
  ) {
    const token = yield* githubToken(input.account, limits);
    const response = yield* output(
      [
        'api',
        '--hostname',
        'github.com',
        `repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues/${input.number}/comments`,
        '--method',
        'POST',
        '--input',
        '-',
      ],
      limits,
      token,
      JSON.stringify({ body: input.body }),
    );
    const decoded = yield* Schema.decodeEffect(githubCommentSchema)(
      response,
    ).pipe(
      Effect.mapError(
        () => new GitHubCommandError({ reason: 'invalid-response' }),
      ),
    );
    return decoded.html_url;
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
  const token = yield* githubToken(input.account, limits);
  const args = ['api', '--hostname', 'github.com', input.endpoint];
  if (input.query === undefined) args.push('--method', 'GET');
  else {
    args.push('--method', 'POST', '-f', `query=${input.query}`);
    for (const [name, value] of Object.entries(input.variables ?? {}))
      args.push(typeof value === 'number' ? '-F' : '-f', `${name}=${value}`);
  }
  return yield* output(args, limits, token);
});

class GitHubMergeRefusedError extends Schema.TaggedError<GitHubMergeRefusedError>()(
  'GitHubMergeRefusedError',
  {
    reason: Schema.Literals(['not-mergeable', 'head-changed']),
    detail: Schema.String,
  },
) {}

const githubMergeSchema = Schema.fromJsonString(
  Schema.Struct({
    merged: Schema.Boolean,
    sha: Schema.optional(Schema.String),
  }),
);

function githubRefusal(stderr: string, token: Redacted.Redacted<string>) {
  const line = stderr
    .split('\n')
    .map((text) => text.trim())
    .find((text) => /\(HTTP 40[59]\)$/.test(text));
  if (!line) return undefined;
  const detail = line
    .replace(/^gh:\s*/, '')
    .replace(/\s*\(HTTP 40[59]\)$/, '')
    .slice(0, 300);
  return new GitHubMergeRefusedError({
    reason: line.endsWith('(HTTP 409)') ? 'head-changed' : 'not-mergeable',
    detail: detail.includes(Redacted.value(token)) ? '' : detail,
  });
}

export const mergeGitHubPullRequest = Effect.fn('Git.mergeGitHubPullRequest')(
  function* (
    input: {
      account: string;
      owner: string;
      repo: string;
      number: number;
      method: 'merge' | 'squash' | 'rebase';
      headSha: string;
    },
    limits: GitLimits,
  ) {
    const token = yield* githubToken(input.account, limits);
    const result = yield* invoke(
      [
        'api',
        '--hostname',
        'github.com',
        `repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.number}/merge`,
        '--method',
        'PUT',
        '--input',
        '-',
      ],
      limits,
      token,
      JSON.stringify({ merge_method: input.method, sha: input.headSha }),
    );
    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString('utf8');
      const refusal = githubRefusal(stderr, token);
      if (refusal) return yield* refusal;
      return yield* new GitHubCommandError({ reason: failureReason(stderr) });
    }
    const decoded = yield* Schema.decodeEffect(githubMergeSchema)(
      result.stdout.toString('utf8'),
    ).pipe(
      Effect.mapError(
        () => new GitHubCommandError({ reason: 'invalid-response' }),
      ),
    );
    if (!decoded.merged)
      return yield* new GitHubMergeRefusedError({
        reason: 'not-mergeable',
        detail: '',
      });
    return decoded.sha;
  },
);
