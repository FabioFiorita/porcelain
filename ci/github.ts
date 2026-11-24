import { execFileSync } from 'node:child_process';
import { Schema } from 'effect';

const IssueComment = Schema.Struct({
  id: Schema.Int,
  body: Schema.String,
  user: Schema.NullOr(Schema.Struct({ type: Schema.String })),
});

const CommitPull = Schema.Struct({
  number: Schema.Int,
  head: Schema.Struct({ sha: Schema.String }),
  base: Schema.Struct({ ref: Schema.String }),
});

const CurrentPull = Schema.Struct({
  author_association: Schema.String,
  state: Schema.String,
  draft: Schema.Boolean,
  head: Schema.Struct({
    sha: Schema.String,
    ref: Schema.String,
    repo: Schema.NullOr(
      Schema.Struct({ owner: Schema.Struct({ login: Schema.String }) }),
    ),
  }),
  base: Schema.Struct({ ref: Schema.String }),
});

type WorkflowHead = { sha: string; owner: string; branch: string };

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

export function resolveWorkflowPullRequest(
  repository: string,
  { sha, owner, branch }: WorkflowHead,
) {
  if (!sha || !owner || !branch) return undefined;
  const base =
    branch === 'main' &&
    owner.toLowerCase() === repository.split('/')[0]?.toLowerCase()
      ? 'release'
      : 'main';
  return pages(
    Schema.Array(CommitPull),
    `repos/${repository}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`,
  )
    .flat()
    .find((pull) => pull.head.sha === sha && pull.base.ref === base);
}

export function isCurrentTrustedPullRequest(
  repository: string,
  number: number,
  head: WorkflowHead,
  base: string,
): boolean {
  const pull = Schema.decodeUnknownSync(Schema.fromJsonString(CurrentPull))(
    gh(['api', `repos/${repository}/pulls/${number}`]),
  );
  return (
    trustedAssociations.has(pull.author_association) &&
    pull.state === 'open' &&
    !pull.draft &&
    pull.head.sha === head.sha &&
    pull.head.ref === head.branch &&
    pull.head.repo?.owner.login.toLowerCase() === head.owner.toLowerCase() &&
    pull.base.ref === base
  );
}

const Check = Schema.Struct({
  name: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
});

const CiJobs = Schema.Struct({ jobs: Schema.Array(Check) });
const CheckRuns = Schema.Struct({ check_runs: Schema.Array(Check) });
const passed = (name: string) => (check: typeof Check.Type) =>
  check.name === name && check.conclusion === 'success';

export function checkPassed(
  repository: string,
  sha: string,
  name: string,
): boolean {
  return pages(CheckRuns, `repos/${repository}/commits/${sha}/check-runs`)
    .flatMap((page) => page.check_runs)
    .some(passed(name));
}

export function requiredCiJobPassed(
  repository: string,
  run: { id: number; run_attempt: number },
  name: string,
): boolean {
  return pages(
    CiJobs,
    `repos/${repository}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`,
  )
    .flatMap((page) => page.jobs)
    .some(passed(name));
}

const CiRuns = Schema.Struct({
  workflow_runs: Schema.Array(
    Schema.Struct({
      id: Schema.Int,
      run_attempt: Schema.Int,
      run_started_at: Schema.NullOr(Schema.String),
      created_at: Schema.String,
      status: Schema.String,
      conclusion: Schema.NullOr(Schema.String),
      head_repository: Schema.NullOr(
        Schema.Struct({ full_name: Schema.String }),
      ),
      pull_requests: Schema.Array(Schema.Struct({ number: Schema.Int })),
    }),
  ),
});

export function pullRequestCiRuns(
  repository: string,
  pull: { number: number; sha: string; branch: string; headRepository: string },
) {
  const query = new URLSearchParams({
    event: 'pull_request',
    head_sha: pull.sha,
    branch: pull.branch,
  });
  const matching = pages(
    CiRuns,
    `repos/${repository}/actions/workflows/ci.yml/runs?${query.toString()}`,
  )
    .flatMap((page) => page.workflow_runs)
    .filter(
      (run) =>
        run.head_repository?.full_name.toLowerCase() ===
          pull.headRepository.toLowerCase() &&
        (run.pull_requests.length === 0 ||
          run.pull_requests.some(({ number }) => number === pull.number)),
    );
  const latest = matching.sort(
    (left, right) =>
      (right.run_started_at ?? right.created_at).localeCompare(
        left.run_started_at ?? left.created_at,
      ) || right.id - left.id,
  )[0];
  return { active: matching.some((run) => run.status !== 'completed'), latest };
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
