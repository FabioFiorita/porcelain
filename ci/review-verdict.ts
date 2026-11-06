import { Option, Schema } from 'effect';
import { decisionModel, reviewModel, strictJsonSchema } from './openai.ts';

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
  paths: readonly string[];
};

export type Triage = {
  reviewProbability: number | undefined;
  requested: boolean;
};

export type Assessment = {
  fixes: readonly ReviewFinding[];
  notes: readonly ReviewFinding[];
  protectedPaths: readonly string[];
  oneWayProbability: number;
  declaredDoor: 'two-way' | 'one-way' | undefined;
  markedDecision: boolean;
  approved: boolean;
  trusted: boolean;
};

export const labels = {
  review: 'agent-review',
  fixes: 'agent-fixes',
  decision: 'decision',
  approved: 'approved',
  hold: 'hold',
} as const;

const ReviewedCommit = Schema.Struct({ sha: Schema.String, review: Review });
export type ReviewedCommit = typeof ReviewedCommit.Type;

export const ReviewState = Schema.Struct({
  reviewed: Schema.optional(ReviewedCommit),
  approvedHead: Schema.optional(Schema.String),
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

const protectedFiles = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.oxlintrc.json',
  '.oxfmtrc.json',
  'scripts/architecture.ts',
  'scripts/style.ts',
]);
const protectedFolders = [
  '.github/',
  'architecture/',
  'ci/',
  'packages/contracts/',
  'packages/storage/drizzle/',
];
const instructionFiles = new Set(['AGENTS.md', 'CLAUDE.md']);
const oneWayThreshold = 0.5;
const reviewThreshold = 0.5;

export function needsReview(triage: Triage): boolean {
  return (
    triage.requested ||
    triage.reviewProbability === undefined ||
    triage.reviewProbability >= reviewThreshold
  );
}

function isProtectedPath(path: string): boolean {
  const name = path.split('/').at(-1) ?? path;
  return (
    instructionFiles.has(name) ||
    protectedFiles.has(path) ||
    protectedFolders.some((folder) => path.startsWith(folder))
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
  oneWayProbability: number,
  current: ReadonlySet<string>,
  access: { approved: boolean; trusted: boolean },
): Assessment {
  const findings = review?.findings ?? [];
  return {
    fixes: findings.filter((finding) => finding.priority <= 2),
    notes: findings.filter((finding) => finding.priority === 3),
    protectedPaths: pullRequest.paths.filter(isProtectedPath),
    oneWayProbability,
    declaredDoor: declaredDoor(pullRequest.body),
    markedDecision: current.has(labels.decision),
    approved: access.approved,
    trusted: access.trusted,
  };
}

function verdict(assessment: Assessment): Verdict {
  if (assessment.fixes.length > 0) return 'needs-fixes';
  const ownerDecides =
    assessment.protectedPaths.length > 0 ||
    assessment.oneWayProbability >= oneWayThreshold ||
    assessment.declaredDoor === 'one-way' ||
    assessment.markedDecision ||
    !assessment.trusted;
  return ownerDecides && !assessment.approved ? 'needs-owner' : 'ready';
}

export function nextStep(
  assessment: Assessment,
  reviewed: boolean,
  current: ReadonlySet<string>,
): Step {
  const result = verdict(assessment);
  const held = current.has(labels.hold);
  const wanted = [
    ...(reviewed ? [labels.review] : []),
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
      'The owner’s approval is saved for this commit; the verdict comes when CI passes.',
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
  const oneWay = assessment.oneWayProbability >= oneWayThreshold;
  return [
    ...(assessment.protectedPaths.length > 0
      ? [
          `Changes protected paths: ${assessment.protectedPaths.map((path) => `\`${path}\``).join(', ')}`,
        ]
      : []),
    ...(oneWay ? ['Doorkeeper reads it as a one-way door'] : []),
    ...(assessment.declaredDoor === 'one-way'
      ? ['The description declares a one-way door']
      : []),
    ...(assessment.declaredDoor === 'two-way' && oneWay
      ? [
          'The description declares a two-way door, but Doorkeeper reads it as one-way',
        ]
      : []),
    ...(assessment.markedDecision ? ['It carries the `decision` label'] : []),
    ...(assessment.trusted
      ? []
      : ['Its author has no write access to the repository']),
  ];
}

function probability(value: number): string {
  return `probability ${value.toFixed(2)}`;
}

function triageLine(triage: Triage): string {
  if (triage.requested)
    return '- **Triage:** skipped; the `agent-review` label keeps the Reviewer on every push.';
  const odds =
    triage.reviewProbability === undefined
      ? 'Triage could not judge it'
      : probability(triage.reviewProbability);
  return needsReview(triage)
    ? `- **Triage:** needs a review (${odds}).`
    : `- **Triage:** no review needed (${odds}).`;
}

function doorkeeperLine(assessment: Assessment): string {
  const door =
    assessment.oneWayProbability >= oneWayThreshold ? 'one-way' : 'two-way';
  return `- **Doorkeeper:** ${door} door (${probability(assessment.oneWayProbability)}).`;
}

export function reviewComment(
  pullRequest: PullRequest,
  triage: Triage,
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
    [triageLine(triage), ...reviewer, doorkeeperLine(assessment)].join('\n'),
    ...(findings.length > 0
      ? [
          '#### Reviewer findings',
          findings
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
    `<sub>Triage and Doorkeeper: \`${decisionModel}\` on the OpenAI Decisions API. Reviewer: \`${reviewModel}\` on the OpenAI Agents API.</sub>`,
  ].join('\n\n');
}
