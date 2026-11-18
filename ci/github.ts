import { execFileSync } from 'node:child_process';
import { Schema } from 'effect';

const IssueComment = Schema.Struct({
  id: Schema.Int,
  body: Schema.String,
  user: Schema.NullOr(Schema.Struct({ type: Schema.String })),
});

const PullRequestAuthor = Schema.Struct({ author_association: Schema.String });
const trustedAssociations = new Set(['OWNER', 'COLLABORATOR']);

export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`${name} must be set; its CI workflow provides it`);
  return value;
}

export function gh(
  args: readonly string[],
  input?: string,
  token?: string,
): string {
  return execFileSync('gh', [...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...(input === undefined ? {} : { input }),
    ...(token === undefined
      ? {}
      : { env: { ...process.env, GH_TOKEN: token } }),
  });
}

export function pages<A>(
  page: Schema.Codec<A, unknown>,
  path: string,
  request: typeof gh = gh,
): readonly A[] {
  return Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Array(page)))(
    request(['api', '--paginate', '--slurp', path]),
  );
}

export function findComment(
  repository: string,
  number: number,
  marker: string,
): { id: number; body: string } | undefined {
  return pages(
    Schema.Array(IssueComment),
    `repos/${repository}/issues/${number}/comments`,
  )
    .flat()
    .find(
      (comment) =>
        comment.user?.type === 'Bot' && comment.body.startsWith(marker),
    );
}

export function upsertComment(
  repository: string,
  number: number,
  marker: string,
  body: string,
): void {
  const existing = findComment(repository, number, marker);
  gh(
    existing
      ? [
          'api',
          '--method',
          'PATCH',
          `repos/${repository}/issues/comments/${existing.id}`,
          '--input',
          '-',
        ]
      : [
          'api',
          '--method',
          'POST',
          `repos/${repository}/issues/${number}/comments`,
          '--input',
          '-',
        ],
    JSON.stringify({ body }),
  );
}

export function trustedAuthor(repository: string, number: number): boolean {
  const pull = Schema.decodeUnknownSync(
    Schema.fromJsonString(PullRequestAuthor),
  )(gh(['api', `repos/${repository}/pulls/${number}`]));
  return trustedAssociations.has(pull.author_association);
}

const CheckRuns = Schema.Struct({
  check_runs: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      status: Schema.String,
      conclusion: Schema.NullOr(Schema.String),
    }),
  ),
});

export function checkPassed(
  repository: string,
  sha: string,
  name: string,
): boolean {
  return pages(CheckRuns, `repos/${repository}/commits/${sha}/check-runs`)
    .flatMap((page) => page.check_runs)
    .some((run) => run.name === name && run.conclusion === 'success');
}

export function isAncestor(
  repository: string,
  ancestor: string,
  sha: string,
): boolean {
  try {
    const status = Schema.decodeUnknownSync(
      Schema.fromJsonString(Schema.Struct({ status: Schema.String })),
    )(gh(['api', `repos/${repository}/compare/${ancestor}...${sha}`]));
    return status.status === 'ahead';
  } catch {
    return false;
  }
}

export function setStatus(
  repository: string,
  sha: string,
  status: {
    state: 'pending' | 'success' | 'failure' | 'error';
    context: string;
    description: string;
    url: string;
  },
): void {
  gh(
    [
      'api',
      '--method',
      'POST',
      `repos/${repository}/statuses/${sha}`,
      '--input',
      '-',
    ],
    JSON.stringify({
      state: status.state,
      context: status.context,
      description: status.description.slice(0, 140),
      target_url: status.url,
    }),
  );
}

export function changeLabels(
  repository: string,
  number: number,
  add: readonly string[],
  remove: readonly string[],
): void {
  if (add.length > 0)
    gh(
      [
        'api',
        '--method',
        'POST',
        `repos/${repository}/issues/${number}/labels`,
        '--input',
        '-',
      ],
      JSON.stringify({ labels: add }),
    );
  for (const label of remove)
    try {
      gh([
        'api',
        '--method',
        'DELETE',
        `repos/${repository}/issues/${number}/labels/${encodeURIComponent(label)}`,
      ]);
    } catch {
      console.log(`The ${label} label was already gone`);
    }
}

const IssueEvent = Schema.Struct({
  event: Schema.String,
  created_at: Schema.optional(Schema.NullOr(Schema.String)),
  label: Schema.optional(Schema.NullOr(Schema.Struct({ name: Schema.String }))),
});

const PullRequestHead = Schema.Struct({
  created_at: Schema.String,
  head: Schema.Struct({
    ref: Schema.String,
    sha: Schema.String,
    repo: Schema.NullOr(Schema.Struct({ full_name: Schema.String })),
  }),
});

const BranchActivity = Schema.Array(
  Schema.Struct({
    after: Schema.String,
    ref: Schema.String,
    timestamp: Schema.String,
  }),
);

export function labeledOnHead(
  repository: string,
  number: number,
  label: string,
  sha: string,
  request: typeof gh = gh,
): boolean {
  try {
    const events = pages(
      Schema.Array(IssueEvent),
      `repos/${repository}/issues/${number}/timeline`,
      request,
    )
      .flat()
      .filter(
        (event) =>
          event.label?.name === label &&
          (event.event === 'labeled' || event.event === 'unlabeled'),
      );
    const lastChange = events.at(-1);
    if (lastChange?.event !== 'labeled') return false;
    const added = Date.parse(lastChange.created_at ?? '');

    const pull = Schema.decodeUnknownSync(
      Schema.fromJsonString(PullRequestHead),
    )(request(['api', `repos/${repository}/pulls/${number}`]));
    if (
      pull.head.sha !== sha ||
      !pull.head.repo ||
      !(added >= Date.parse(pull.created_at))
    )
      return false;

    const ref = `refs/heads/${pull.head.ref}`;
    const [latest] = Schema.decodeUnknownSync(
      Schema.fromJsonString(BranchActivity),
    )(
      request([
        'api',
        `repos/${pull.head.repo.full_name}/activity?ref=${encodeURIComponent(ref)}&per_page=1`,
      ]),
    );
    return (
      latest?.ref === ref &&
      latest.after === sha &&
      Date.parse(latest.timestamp) < added
    );
  } catch {
    console.log(
      `Could not verify the ${label} label against the head of #${number}`,
    );
    return false;
  }
}
