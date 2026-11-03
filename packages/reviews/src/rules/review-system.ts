import type { Review } from '../models/review.ts';

export function reviewSystem(
  review: Pick<Review, 'files' | 'layers' | 'diagram'>,
) {
  const modules = review.files.flatMap<{
    path: string;
    change: 'new' | 'changed' | 'removed';
  }>((file) => {
    const current = {
      path: file.path,
      change: file.status === 'added' ? ('new' as const) : ('changed' as const),
    };
    if (file.status === 'deleted')
      return [{ path: file.path, change: 'removed' as const }];
    if (file.status === 'renamed' && file.oldPath && file.oldPath !== file.path)
      return [
        { path: file.oldPath, change: 'removed' as const },
        { ...current, change: 'new' as const },
      ];
    return [current];
  });
  const folders = [
    ...new Set(
      modules.map(
        (module) => module.path.split('/').slice(0, -1).join('/') || '.',
      ),
    ),
  ].sort();
  const owners = folders.map((path) => {
    const owned = modules.filter(
      (module) =>
        (module.path.split('/').slice(0, -1).join('/') || '.') === path,
    );
    const paths = new Set(owned.map((module) => module.path));
    const layers = new Set(
      review.layers
        .filter((layer) =>
          layer.steps.some((step) => paths.has(step.pointer.path)),
        )
        .map((layer) => layer.id),
    );
    return {
      path,
      files: owned,
      annotations: (review.diagram?.after.boxes ?? []).filter(
        (box) => box.layerId !== undefined && layers.has(box.layerId),
      ),
    };
  });
  const guards = modules
    .filter((module) =>
      /(?:^|\/)(?:architecture\/|[^/]*oxlint[^/]*|[^/]*eslint[^/]*|[^/]*lint-rules?\/)/.test(
        module.path,
      ),
    )
    .map((module) => module.path);
  return { kind: 'git-files' as const, owners, guards };
}
