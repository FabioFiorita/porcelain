import type {
  GitHubPullStatus,
  PullCheckDetail,
  PullRequestStatus,
} from '../models/pull-request.ts';

type RawCheck = NonNullable<
  GitHubPullStatus['commits']['nodes'][number]['commit']['statusCheckRollup']
>['contexts']['nodes'][number];

const RERUN_PERMISSIONS = new Set(['ADMIN', 'MAINTAIN', 'WRITE']);

function actionsIds(url: string | undefined): {
  runId: number | undefined;
  jobId: number | undefined;
} {
  if (url === undefined) return { runId: undefined, jobId: undefined };
  const match =
    /^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/(\d+)(?:\/jobs?\/(\d+))?(?:[/?#]|$)/.exec(
      url,
    );
  return {
    runId: match?.[1] === undefined ? undefined : Number(match[1]),
    jobId: match?.[2] === undefined ? undefined : Number(match[2]),
  };
}

type Nullable = Extract<RawCheck, { __typename: 'CheckRun' }>['detailsUrl'];
function present(value: Nullable | undefined): string | undefined {
  const text = value ?? undefined;
  return text === '' ? undefined : text;
}

function mapCheck(raw: RawCheck): PullCheckDetail {
  const waiting =
    raw.__typename === 'StatusContext' &&
    (raw.state === 'PENDING' || raw.state === 'EXPECTED');
  if (raw.__typename === 'StatusContext')
    return {
      key: `status:${raw.context}`,
      kind: 'status',
      name: raw.context,
      status: waiting ? 'PENDING' : 'COMPLETED',
      conclusion: waiting ? undefined : raw.state,
      detailsUrl: present(raw.targetUrl),
      startedAt: undefined,
      completedAt: undefined,
      group: 'Statuses',
      runId: undefined,
      jobId: undefined,
      required: raw.isRequired ?? false,
      summary: present(raw.description),
      steps: [],
      annotations: [],
    };
  const fromUrl = actionsIds(present(raw.detailsUrl));
  const workflowRun = raw.checkSuite?.workflowRun;
  const runId = workflowRun?.databaseId ?? fromUrl.runId;
  const actions =
    raw.checkSuite?.app?.slug === 'github-actions' ||
    (workflowRun ?? undefined) !== undefined ||
    fromUrl.jobId !== undefined;
  const jobId = actions ? (raw.databaseId ?? fromUrl.jobId) : undefined;
  const group = actions
    ? (workflowRun?.workflow?.name ?? 'GitHub Actions')
    : (present(raw.checkSuite?.app?.name) ?? 'Other checks');
  const summary = [present(raw.title), present(raw.summary)]
    .filter((part) => part !== undefined)
    .join('\n\n');
  return {
    key:
      actions && runId !== undefined
        ? `actions:${runId}:${raw.name}`
        : `check:${group}:${raw.name}`,
    kind:
      actions && jobId !== undefined && runId !== undefined
        ? 'actions'
        : 'check',
    name: raw.name,
    status: raw.status,
    conclusion: present(raw.conclusion),
    detailsUrl: present(raw.detailsUrl),
    startedAt: present(raw.startedAt),
    completedAt: present(raw.completedAt),
    group,
    runId: actions ? runId : undefined,
    jobId,
    required: raw.isRequired ?? false,
    summary: summary === '' ? undefined : summary,
    steps: (raw.steps?.nodes ?? [])
      .map((step) => ({
        number: step.number,
        name: step.name,
        status: step.status,
        conclusion: present(step.conclusion),
        startedAt: present(step.startedAt),
        completedAt: present(step.completedAt),
      }))
      .sort((a, b) => a.number - b.number),
    annotations: (raw.annotations?.nodes ?? []).map((annotation) => ({
      level: annotation.annotationLevel ?? 'NOTICE',
      message: annotation.message,
      title: present(annotation.title),
      path: present(annotation.path),
      line: annotation.location?.start.line,
    })),
  };
}

function uniqueKeys(checks: readonly PullCheckDetail[]) {
  const seen = new Map<string, number>();
  return checks.map((check) => {
    const count = (seen.get(check.key) ?? 0) + 1;
    seen.set(check.key, count);
    return count === 1 ? check : { ...check, key: `${check.key}#${count}` };
  });
}

export function mapPullStatus(raw: GitHubPullStatus): PullRequestStatus {
  const rollup = raw.commits.nodes[0]?.commit.statusCheckRollup;
  return {
    number: raw.number,
    state:
      raw.state === 'OPEN'
        ? 'open'
        : raw.state === 'MERGED'
          ? 'merged'
          : 'closed',
    draft: raw.isDraft,
    headSha: raw.headRefOid,
    mergeable: raw.mergeable,
    mergeState: present(raw.mergeStateStatus),
    reviewDecision: present(raw.reviewDecision),
    requestedReviewers: (raw.reviewRequests?.nodes ?? []).flatMap(
      ({ requestedReviewer }) => {
        const name =
          requestedReviewer?.login ??
          requestedReviewer?.name ??
          requestedReviewer?.slug;
        return name === undefined ? [] : [name];
      },
    ),
    canRerun: RERUN_PERMISSIONS.has(raw.viewerPermission ?? ''),
    checks: uniqueKeys((rollup?.contexts.nodes ?? []).map(mapCheck)),
    checksTruncated: rollup?.contexts.pageInfo.hasNextPage ?? false,
    checksSummary: rollup?.state ?? undefined,
  };
}
