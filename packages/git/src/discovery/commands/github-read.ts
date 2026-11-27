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
  budget?: { maxBytes: number; timeoutMs: number },
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
    maxBytes: budget?.maxBytes ?? Math.min(limits.outputBytes, 4 * 1024 * 1024),
    timeoutMs: budget?.timeoutMs ?? limits.readTimeoutMs,
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
  if (result.stopped === 'output-limit' && budget === undefined)
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

function githubErrorLine(stderr: string, status: RegExp) {
  return stderr
    .split('\n')
    .map((text) => text.trim())
    .find((text) => status.test(text));
}

function githubErrorDetail(line: string, token: Redacted.Redacted<string>) {
  const detail = line
    .replace(/^gh:\s*/, '')
    .replace(/\s*\(HTTP 4\d\d\)$/, '')
    .slice(0, 300);
  return detail.includes(Redacted.value(token)) ? '' : detail;
}

class GitHubWriteRefusedError extends Schema.TaggedError<GitHubWriteRefusedError>()(
  'GitHubWriteRefusedError',
  { detail: Schema.String },
) {}

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

function githubJsonWrite(endpoint: string, method: 'POST' | 'PUT') {
  return [
    'api',
    '--hostname',
    'github.com',
    endpoint,
    '--method',
    method,
    '--input',
    '-',
  ];
}

const postGitHubComment = Effect.fn('Git.postGitHubComment')(function* (
  account: string,
  endpoint: string,
  payload: object,
  limits: GitLimits,
) {
  const token = yield* githubToken(account, limits);
  const result = yield* invoke(
    githubJsonWrite(endpoint, 'POST'),
    limits,
    token,
    JSON.stringify(payload),
  );
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString('utf8');
    const invalid = githubErrorLine(stderr, /\(HTTP 422\)$/);
    if (invalid)
      return yield* new GitHubWriteRefusedError({
        detail: githubErrorDetail(invalid, token),
      });
    return yield* new GitHubCommandError({ reason: failureReason(stderr) });
  }
  const response = result.stdout.toString('utf8');
  if (response.includes(Redacted.value(token)))
    return yield* new GitHubCommandError({ reason: 'invalid-response' });
  const decoded = yield* Schema.decodeEffect(githubCommentSchema)(
    response,
  ).pipe(
    Effect.mapError(
      () => new GitHubCommandError({ reason: 'invalid-response' }),
    ),
  );
  return decoded.html_url;
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
    return yield* postGitHubComment(
      input.account,
      `repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues/${input.number}/comments`,
      { body: input.body },
      limits,
    );
  },
);

export const postGitHubPullRequestReview = Effect.fn(
  'Git.postGitHubPullRequestReview',
)(function* (
  input: {
    account: string;
    owner: string;
    repo: string;
    number: number;
    commitId: string;
    body: string;
    comments: readonly {
      path: string;
      side: 'LEFT' | 'RIGHT';
      startLine?: number | undefined;
      line: number;
      body: string;
    }[];
  },
  limits: GitLimits,
) {
  return yield* postGitHubComment(
    input.account,
    `repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.number}/reviews`,
    {
      commit_id: input.commitId,
      event: 'COMMENT',
      body: input.body,
      comments: input.comments.map((comment) => ({
        path: comment.path,
        side: comment.side,
        line: comment.line,
        body: comment.body,
        ...(comment.startLine === undefined
          ? {}
          : { start_line: comment.startLine, start_side: comment.side }),
      })),
    },
    limits,
  );
});

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
  const line = githubErrorLine(stderr, /\(HTTP 40[59]\)$/);
  if (!line) return undefined;
  return new GitHubMergeRefusedError({
    reason: line.endsWith('(HTTP 409)') ? 'head-changed' : 'not-mergeable',
    detail: githubErrorDetail(line, token),
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
      githubJsonWrite(
        `repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.number}/merge`,
        'PUT',
      ),
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

const JOB_LOG_BYTES = 16 * 1024 * 1024;
const JOB_LOG_TIMEOUT_MS = 60_000;

export const readGitHubJobLog = Effect.fn('Git.readGitHubJobLog')(function* (
  input: { account: string; owner: string; repo: string; jobId: number },
  limits: GitLimits,
) {
  const token = yield* githubToken(input.account, limits);
  const result = yield* invoke(
    [
      'api',
      '--hostname',
      'github.com',
      `repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/jobs/${input.jobId}/logs`,
      '--method',
      'GET',
    ],
    limits,
    token,
    undefined,
    { maxBytes: JOB_LOG_BYTES, timeoutMs: JOB_LOG_TIMEOUT_MS },
  );
  if (result.stopped === 'output-limit')
    return { kind: 'log-too-large' as const };
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString('utf8');
    if (/HTTP (404|410)/.test(stderr)) return { kind: 'log-missing' as const };
    return yield* new GitHubCommandError({ reason: failureReason(stderr) });
  }
  const text = result.stdout.toString('utf8');
  if (text.includes(Redacted.value(token)))
    return yield* new GitHubCommandError({ reason: 'invalid-response' });
  return { kind: 'log' as const, text };
});

function githubWriteRefusal(stderr: string, token: Redacted.Redacted<string>) {
  const line = githubErrorLine(stderr, /\(HTTP 4(0[0-9]|22)\)$/);
  if (!line || /\(HTTP 429\)$/.test(line)) return undefined;
  if (/rate limit/i.test(line)) return undefined;
  return new GitHubWriteRefusedError({
    detail: githubErrorDetail(line, token),
  });
}

export const rerunGitHubActions = Effect.fn('Git.rerunGitHubActions')(
  function* (
    input: {
      account: string;
      owner: string;
      repo: string;
      target:
        | { kind: 'failed-jobs'; runId: number }
        | { kind: 'job'; jobId: number };
    },
    limits: GitLimits,
  ) {
    const token = yield* githubToken(input.account, limits);
    const root = `repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions`;
    const result = yield* invoke(
      [
        'api',
        '--hostname',
        'github.com',
        input.target.kind === 'job'
          ? `${root}/jobs/${input.target.jobId}/rerun`
          : `${root}/runs/${input.target.runId}/rerun-failed-jobs`,
        '--method',
        'POST',
      ],
      limits,
      token,
    );
    if (result.exitCode === 0) return;
    const stderr = result.stderr.toString('utf8');
    const refusal = githubWriteRefusal(stderr, token);
    if (refusal) return yield* refusal;
    return yield* new GitHubCommandError({ reason: failureReason(stderr) });
  },
);
