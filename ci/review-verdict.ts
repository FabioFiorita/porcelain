import { Option, Schema } from 'effect';
import { strictJsonSchema } from './openai.ts';

export const ReviewFinding = Schema.Struct({
  title: Schema.String,
  body: Schema.String,
  priority: Schema.Literals([0, 1, 2, 3]),
  path: Schema.String,
  line_start: Schema.Int,
  line_end: Schema.Int,
});
export type ReviewFinding = typeof ReviewFinding.Type;

export const Review = Schema.Struct({
  findings: Schema.Array(ReviewFinding),
  summary: Schema.String,
});
export type Review = typeof Review.Type;

export const reviewJsonSchema = strictJsonSchema(Review);

export type PullRequest = {
  repository: string;
  headSha: string;
  body: string;
  files: readonly {
    filename: string;
    previous_filename?: string | undefined;
    patch?: string | undefined;
  }[];
};

export type Assessment = {
  fixes: readonly ReviewFinding[];
  accepted: readonly ReviewFinding[];
  notes: readonly ReviewFinding[];
  protectedPaths: readonly string[];
  declaredDoor: 'two-way' | 'one-way' | undefined;
  markedDecision: boolean;
  approved: boolean;
  owner: boolean;
  requestedDecision: boolean;
};

export const labels = {
  review: 'agent-review',
  fixes: 'agent-fixes',
  decision: 'decision',
  approved: 'approved',
  reviewed: 'reviewed',
  hold: 'hold',
} as const;

const ReviewedCommit = Schema.Struct({ sha: Schema.String, review: Review });
export type ReviewedCommit = typeof ReviewedCommit.Type;

export const ReviewState = Schema.Struct({
  releaseBase: Schema.optional(Schema.String),
  reviewed: Schema.optional(ReviewedCommit),
  decision: Schema.optional(
    Schema.Struct({ sha: Schema.String, needsOwner: Schema.Boolean }),
  ),
  approvedHead: Schema.optional(Schema.String),
  markedReviewedHead: Schema.optional(Schema.String),
});
export type ReviewState = typeof ReviewState.Type;

export type Step = {
  verdict: Verdict;
  status: 'success' | 'failure';
  description: string;
  add: readonly string[];
  remove: readonly string[];
  merge: boolean;
};

type Verdict = 'ready' | 'needs-fixes' | 'needs-owner';

function isProtectedPath(path: string, patch: string | undefined): boolean {
  if (path === 'package.json')
    return patch === undefined || /^[+-]  "version":/m.test(patch);
  if (
    path.startsWith('.github/workflows/') &&
    (patch === undefined ||
      /^[+-].*(?:\bpermissions\s*:|\bsecrets\b|:\s*(?:read|write|none)(?:\s|$)|pull_request_target|workflow_run)/m.test(
        patch,
      ))
  )
    return true;
  return (
    path.startsWith('packages/storage/drizzle/') ||
    path.startsWith('.agents/skills/release/') ||
    path.startsWith('.github/workflows/release') ||
    path === '.github/workflows/agent-review.yml' ||
    path === '.github/CODEOWNERS' ||
    path === 'ci/github.ts' ||
    path === 'ci/review-judgment.ts' ||
    path === 'ci/review.ts' ||
    path === 'ci/review-verdict.ts'
  );
}

function declaredDoor(body: string): Assessment['declaredDoor'] {
  const door = /^Door:\s*(two-way|one-way)\b/im.exec(body)?.[1]?.toLowerCase();
  return door === 'two-way' || door === 'one-way' ? door : undefined;
}

export function approvalHolds(
  current: ReadonlySet<string>,
  head: string,
  approvedHead: string | undefined,
): boolean {
  return current.has(labels.approved) && approvedHead === head;
}

export function assess(
  pullRequest: PullRequest,
  review: Review | undefined,
  current: ReadonlySet<string>,
  access: {
    lane: 'main' | 'release';
    approved: boolean;
    owner: boolean;
    requestedDecision?: boolean;
  },
): Assessment {
  const findings = review?.findings ?? [];
  const acceptsPriorityTwo = access.lane === 'release' && access.approved;
  return {
    fixes: findings.filter(
      (finding) => finding.priority <= (acceptsPriorityTwo ? 1 : 2),
    ),
    accepted: acceptsPriorityTwo
      ? findings.filter((finding) => finding.priority === 2)
      : [],
    notes: findings.filter((finding) => finding.priority === 3),
    protectedPaths: pullRequest.files.flatMap((file) =>
      [file.filename, file.previous_filename].filter(
        (path): path is string =>
          path !== undefined && isProtectedPath(path, file.patch),
      ),
    ),
    declaredDoor: declaredDoor(pullRequest.body),
    markedDecision: current.has(labels.decision),
    approved: access.approved,
    owner: access.owner,
    requestedDecision: access.requestedDecision === true,
  };
}

function verdict(assessment: Assessment): Verdict {
  if (assessment.fixes.length > 0) return 'needs-fixes';
  const ownerDecides =
    assessment.requestedDecision ||
    assessment.protectedPaths.length > 0 ||
    assessment.declaredDoor === 'one-way' ||
    assessment.markedDecision ||
    !assessment.owner;
  return ownerDecides && !assessment.approved ? 'needs-owner' : 'ready';
}

export function nextStep(
  assessment: Assessment,
  current: ReadonlySet<string>,
): Step {
  const result = verdict(assessment);
  const held = current.has(labels.hold);
  const wanted = [
    ...(result === 'needs-fixes' ? [labels.fixes] : []),
    ...(result === 'needs-owner' ? [labels.decision] : []),
  ];
  const descriptions: Record<Verdict, string> = {
    ready: held
      ? 'Ready, but the hold label keeps it from merging'
      : 'Ready: merging once CI is green',
    'needs-fixes': `${assessment.fixes.length} finding(s) to fix before merging`,
    'needs-owner': 'Needs the owner: add the approved label to merge',
  };
  return {
    verdict: result,
    status: result === 'ready' ? 'success' : 'failure',
    description: descriptions[result],
    add: wanted.filter((label) => !current.has(label)),
    remove: [
      ...(result !== 'needs-fixes' && current.has(labels.fixes)
        ? [labels.fixes]
        : []),
      ...(current.has(labels.approved) && !assessment.approved
        ? [labels.approved]
        : []),
    ],
    merge: result === 'ready' && !held,
  };
}

const stateLine = /^<!-- porcelain-agent-state ([A-Za-z0-9+/=]+) -->$/m;

export function savedState(
  comment: string | undefined,
): ReviewState | undefined {
  const encoded =
    comment === undefined ? undefined : stateLine.exec(comment)?.[1];
  if (encoded === undefined) return undefined;
  return Option.getOrUndefined(
    Schema.decodeUnknownOption(Schema.fromJsonString(ReviewState))(
      Buffer.from(encoded, 'base64').toString('utf8'),
    ),
  );
}

function stateComment(state: ReviewState | undefined): string[] {
  return state
    ? [
        `<!-- porcelain-agent-state ${Buffer.from(JSON.stringify(state)).toString('base64')} -->`,
      ]
    : [];
}

export function withState(
  comment: string | undefined,
  state: ReviewState,
): string {
  const line = stateComment(state).join('');
  if (comment === undefined)
    return [
      reviewCommentMarker,
      line,
      '### Waiting for CI',
      state.approvedHead
        ? 'The owner’s approval is saved for this commit; the verdict comes when CI passes.'
        : 'The verdict comes when CI passes.',
    ].join('\n\n');
  return stateLine.test(comment)
    ? comment.replace(stateLine, line)
    : comment.replace(reviewCommentMarker, `${reviewCommentMarker}\n\n${line}`);
}

export const reviewCommentMarker = '<!-- porcelain-agent-review -->';

const headlines: Record<Verdict, string> = {
  ready: 'Ready to merge',
  'needs-fixes': 'Needs fixes before merging',
  'needs-owner': 'Needs the owner’s decision',
};

function findingLine(pullRequest: PullRequest, finding: ReviewFinding): string {
  const lines =
    finding.line_end > finding.line_start
      ? `L${finding.line_start}-L${finding.line_end}`
      : `L${finding.line_start}`;
  const link = `https://github.com/${pullRequest.repository}/blob/${pullRequest.headSha}/${finding.path}#${lines}`;
  return `- **P${finding.priority}** [${finding.title}](${link})\n\n  ${finding.body.replaceAll('\n', '\n  ')}`;
}

function ownerReasons(assessment: Assessment): string[] {
  return [
    ...(assessment.protectedPaths.length > 0
      ? [
          `Changes protected paths: ${assessment.protectedPaths.map((path) => `\`${path}\``).join(', ')}`,
        ]
      : []),
    ...(assessment.requestedDecision
      ? ['The Decisions API check flagged a consequential change']
      : []),
    ...(assessment.declaredDoor === 'one-way'
      ? ['The description declares a one-way door']
      : []),
    ...(assessment.markedDecision ? ['It carries the `decision` label'] : []),
    ...(assessment.owner ? [] : ['This is an outside contribution']),
  ];
}

export function reviewComment(
  pullRequest: PullRequest,
  review: Review | undefined,
  assessment: Assessment,
  state: ReviewState | undefined,
): string {
  const reasons = ownerReasons(assessment);
  const findings = [...assessment.fixes, ...assessment.notes];
  const reviewer = review ? [`- **Reviewer:** ${review.summary}`] : [];
  return [
    reviewCommentMarker,
    ...stateComment(state),
    `### ${headlines[verdict(assessment)]}`,
    `Judged commit \`${pullRequest.headSha.slice(0, 12)}\`.`,
    ...reviewer,
    ...(findings.length > 0
      ? [
          '#### Reviewer findings',
          findings
            .map((finding) => findingLine(pullRequest, finding))
            .join('\n'),
        ]
      : []),
    ...(assessment.accepted.length > 0
      ? [
          '#### Findings accepted by the owner',
          assessment.accepted
            .map((finding) => findingLine(pullRequest, finding))
            .join('\n'),
        ]
      : []),
    ...(reasons.length > 0
      ? [
          assessment.approved
            ? '#### The owner approved it despite'
            : '#### Why the owner decides',
          reasons.map((reason) => `- ${reason}`).join('\n'),
        ]
      : []),
  ].join('\n\n');
}
