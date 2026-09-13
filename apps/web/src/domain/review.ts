import type { ArtifactMetadataResponse } from '@porcelain/contracts/artifacts';
import type { CommitChangesResponse } from '@porcelain/contracts/commit-changes';
import type { CommitPageResponse } from '@porcelain/contracts/commit-history';
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

export type Directory = DirectoryResponse;
export type History = CommitPageResponse;
export type Artifact = ArtifactMetadataResponse;
export type Status = GitStatusResponse;
export type Layers = ReturnType<typeof reviewLayersResponseSchema.parse>;
export type Change = Status['changes'][number];
export type ReviewScope = { projectId: string; worktreeId: string };
export const SURFACES = ['changes', 'files', 'history'] as const;
export type Surface = (typeof SURFACES)[number];
export const SURFACE_LABELS: Record<Surface, string> = {
  changes: 'Changes',
  files: 'Files',
  history: 'History',
};
export function isSurface(value: unknown): value is Surface {
  return SURFACES.some((surface) => surface === value);
}
export function changePath(change: Change) {
  return 'path' in change
    ? change.path
    : (change.newPath ?? change.oldPath ?? '');
}
export function changeKey(change: Change) {
  return JSON.stringify([change.scope, changePath(change)]);
}

export function basename(path: string) {
  return path.split('/').at(-1) ?? path;
}

export function shortOid(oid: string) {
  return oid.slice(0, 7);
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
