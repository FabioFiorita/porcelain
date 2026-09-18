import type { Layers, ReviewScope, TextFile } from './review';

export type ReviewGuide = NonNullable<Layers['layers'][number]['guide']>;
export type GuideSource = ReviewGuide['steps'][number]['source'];
export type GuideSourceRead =
  | { kind: 'loading' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'ready'; file: TextFile };

export function guideSourceStatus(source: GuideSource, file: TextFile) {
  if (file.path !== source.path) return 'unavailable';
  if (!file.contentFingerprint) return 'unverified';
  if (file.contentFingerprint !== source.contentFingerprint) return 'stale';
  const lines =
    file.text === ''
      ? 0
      : file.text.split('\n').length - Number(file.text.endsWith('\n'));
  if (
    !Number.isSafeInteger(source.startLine) ||
    !Number.isSafeInteger(source.endLine) ||
    source.startLine < 1 ||
    source.endLine < source.startLine ||
    source.endLine > lines
  )
    return 'invalid-range';
  return 'current';
}

export function guidePositionKey(
  environmentId: string,
  scope: ReviewScope,
  layerId: string,
) {
  return `porcelain.guide-position.v1.${JSON.stringify([
    environmentId,
    scope.projectId,
    scope.worktreeId,
    layerId,
  ])}`;
}

export function selectedGuideStep(guide: ReviewGuide, stepId: string | null) {
  return guide.steps.find((step) => step.id === stepId) ?? guide.steps[0];
}
