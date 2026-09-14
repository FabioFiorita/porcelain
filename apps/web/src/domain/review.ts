import type {
  ArtifactContentResponse,
  ArtifactMetadataResponse,
} from '@porcelain/contracts/artifacts';
import type { CommitChangesResponse } from '@porcelain/contracts/commit-changes';
import type { CommitPageResponse } from '@porcelain/contracts/commit-history';
import type {
  EvidenceResponse as EvidenceResponseContract,
  ReviewEvidence as ReviewEvidenceResponse,
} from '@porcelain/contracts/evidence';
import type {
  DirectoryResponse,
  TextResponse,
} from '@porcelain/contracts/files';
import type {
  GitDiffRequest,
  GitDiffResponse,
} from '@porcelain/contracts/git-diff';
import type { GitStatusResponse } from '@porcelain/contracts/git-status';
import type { reviewLayersResponseSchema } from '@porcelain/contracts/review-layers';
import type {
  ReviewedMark as ReviewedMarkResponse,
  ReviewedMarksResponse as ReviewedMarksResponseContract,
  SetReviewedRequest as SetReviewedRequestContract,
} from '@porcelain/contracts/reviewed-files';

export type Directory = DirectoryResponse;
export type History = CommitPageResponse;
export type Artifact = ArtifactMetadataResponse;
export type ArtifactContent = ArtifactContentResponse;
export type Status = GitStatusResponse;
export type Layers = ReturnType<typeof reviewLayersResponseSchema.parse>;
export type Change = Status['changes'][number];
export type EvidenceResponse = EvidenceResponseContract;
export type Evidence = ReviewEvidenceResponse;
export type ReviewedMark = ReviewedMarkResponse;
export type ReviewedMarksResponse = ReviewedMarksResponseContract;
export type SetReviewedRequest = SetReviewedRequestContract;
export type ReviewStatus = 'unreviewed' | 'reviewed' | 'stale';
export type ReviewEvidenceItem = Evidence & {
  environmentId: string;
  worktreeId: string;
  statusToken: string;
  consistency: 'best-effort';
  reviewStatus: ReviewStatus;
  mark?: ReviewedMark;
};
export type ReviewScope = { projectId: string; worktreeId: string };
const SURFACES = ['changes', 'files', 'history'] as const;
export type Surface = (typeof SURFACES)[number];
export function isSurface(value: unknown): value is Surface {
  return SURFACES.some((surface) => surface === value);
}
export function changePath(change: Change) {
  return 'path' in change
    ? change.path
    : (change.newPath ?? change.oldPath ?? '');
}
function changeKey(change: Change) {
  return JSON.stringify([change.scope, changePath(change)]);
}

export function orderReviewEvidence<T extends { path: string }>(
  evidence: readonly T[],
  files: readonly { path: string }[],
): T[] {
  const remaining = new Map(evidence.map((entry) => [entry.path, entry]));
  const ordered: T[] = [];
  for (const file of files) {
    const entry = remaining.get(file.path);
    if (!entry) continue;
    ordered.push(entry);
    remaining.delete(file.path);
  }
  return [...ordered, ...remaining.values()];
}

export function reviewStatus(
  evidence: Pick<Evidence, 'path' | 'fingerprint'>,
  marks: readonly ReviewedMark[],
): ReviewStatus {
  if (evidence.fingerprint == null) return 'unreviewed';
  const mark = marks.find((candidate) => candidate.path === evidence.path);
  if (!mark) return 'unreviewed';
  return mark.fingerprint === evidence.fingerprint ? 'reviewed' : 'stale';
}

export function reviewMark(
  evidence: Pick<Evidence, 'path'>,
  marks: readonly ReviewedMark[],
) {
  return marks.find((candidate) => candidate.path === evidence.path);
}

export function reviewProgress(
  paths: readonly string[],
  evidence: readonly Pick<ReviewEvidenceItem, 'path' | 'reviewStatus'>[],
) {
  const uniquePaths = new Set(paths.filter(Boolean));
  const reviewedPaths = new Set(
    evidence
      .filter((entry) => entry.reviewStatus === 'reviewed')
      .map((entry) => entry.path),
  );
  let done = 0;
  for (const path of uniquePaths) {
    if (reviewedPaths.has(path)) done += 1;
  }
  return { done, total: uniquePaths.size };
}

export function isFingerprintable(
  evidence: Pick<Evidence, 'fingerprint'>,
): evidence is Pick<Evidence, 'fingerprint'> & { fingerprint: string } {
  return evidence.fingerprint != null;
}

export function basename(path: string) {
  return path.split('/').at(-1) ?? path;
}

export function shortOid(oid: string) {
  return oid.slice(0, 7);
}

export type ArtifactKind = 'html' | 'markdown' | 'text';

export function artifactKind(name: string, content = ''): ArtifactKind {
  const lower = name.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.md') || lower.endsWith('.mdx')) return 'markdown';
  const leading = content.trimStart();
  const lowerLeading = leading.toLowerCase();
  if (
    lowerLeading.startsWith('<!doctype html') ||
    lowerLeading.startsWith('<html')
  )
    return 'html';
  if (/^#{1,6}\s/u.test(leading)) return 'markdown';
  return 'text';
}
export function groupChanges(status: Status, layers: Layers) {
  const assigned = new Set(
    layers.layers.flatMap((layer) =>
      layer.files.map((file) => JSON.stringify([file.scope, file.path])),
    ),
  );
  const groups = layers.layers.flatMap((layer) => {
    const changes = layer.files.flatMap((file) =>
      status.changes.filter(
        (change) =>
          change.scope === file.scope && changePath(change) === file.path,
      ),
    );
    return changes.length
      ? [{ id: layer.id, title: layer.title, changes }]
      : [];
  });
  const unassigned = status.changes.filter(
    (change) => !assigned.has(changeKey(change)),
  );
  return [
    ...groups,
    ...(unassigned.length
      ? [{ id: 'unassigned', title: 'Unassigned', changes: unassigned }]
      : []),
  ];
}

export type TextFile = TextResponse;
export type DiffRequest = GitDiffRequest;
export type Diff = GitDiffResponse;
export type CommitChanges = CommitChangesResponse;

export type { CommitReviewLayersResponse as CommitReviewLayers } from '@porcelain/contracts/commit-review-layers';
export type {
  FileEdit,
  FileEditResult,
  FileTree,
} from '@porcelain/contracts/files';
export type { ReviewSummary } from '@porcelain/contracts/reviewed-files';
