import { Schema } from 'effect';
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
  paths: readonly string[];
};

export type Assessment = {
  fixes: readonly ReviewFinding[];
  notes: readonly ReviewFinding[];
  protectedPaths: readonly string[];
  oneWayProbability: number;
  declaredDoor: 'two-way' | 'one-way' | undefined;
};

export type Verdict = 'ready' | 'needs-fixes' | 'needs-owner';

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

export function assess(
  pullRequest: PullRequest,
  review: Review,
  oneWayProbability: number,
): Assessment {
  return {
    fixes: review.findings.filter((finding) => finding.priority <= 2),
    notes: review.findings.filter((finding) => finding.priority === 3),
    protectedPaths: pullRequest.paths.filter(isProtectedPath),
    oneWayProbability,
    declaredDoor: declaredDoor(pullRequest.body),
  };
}

export function verdict(assessment: Assessment): Verdict {
  if (assessment.fixes.length > 0) return 'needs-fixes';
  const ownerDecides =
    assessment.protectedPaths.length > 0 ||
    assessment.oneWayProbability >= oneWayThreshold ||
    assessment.declaredDoor === 'one-way';
  return ownerDecides ? 'needs-owner' : 'ready';
}

export const reviewCommentMarker = '<!-- porcelain-agent-review -->';

const headlines: Record<Verdict, string> = {
  ready: 'Ready to merge once CI is green',
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
    ...(oneWay
      ? [
          `Reads as a one-way door (probability ${assessment.oneWayProbability.toFixed(2)})`,
        ]
      : []),
    ...(assessment.declaredDoor === 'one-way'
      ? ['The description declares a one-way door']
      : []),
    ...(assessment.declaredDoor === 'two-way' && oneWay
      ? [
          'The description declares a two-way door, but the change reads as one-way',
        ]
      : []),
  ];
}

export function reviewComment(
  pullRequest: PullRequest,
  review: Review,
  assessment: Assessment,
  model: string,
): string {
  const reasons = ownerReasons(assessment);
  const findings = [...assessment.fixes, ...assessment.notes];
  return [
    reviewCommentMarker,
    `### Agent review: ${headlines[verdict(assessment)]}`,
    `Reviewed \`${pullRequest.headSha.slice(0, 12)}\` with \`${model}\`. ${review.summary}`,
    ...(findings.length > 0
      ? [
          '#### Findings',
          findings
            .map((finding) => findingLine(pullRequest, finding))
            .join('\n'),
        ]
      : []),
    ...(reasons.length > 0
      ? [
          '#### Why the owner decides',
          reasons.map((reason) => `- ${reason}`).join('\n'),
        ]
      : []),
  ].join('\n\n');
}
