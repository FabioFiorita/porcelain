import type { Review } from '../models/review.ts';
import type { ModuleGraph, ReviewSystem } from '../models/review-system.ts';

function defaultOwner(path: string) {
  const feature = path.match(/^(.*?\/(?:features|src)\/features\/[^/]+)/);
  if (feature) return feature[1] ?? '.';
  const pkg = path.match(/^(.*?(?:packages|apps)\/[^/]+)/);
  return pkg?.[1] ?? (path.split('/').slice(0, -1).join('/') || '.');
}
export function reviewSystem(
  review: Pick<Review, 'files' | 'layers' | 'diagram'>,
  graphs: { base: ModuleGraph; head: ModuleGraph },
): ReviewSystem {
  const changed = new Map<string, 'new' | 'changed' | 'removed'>();
  for (const file of review.files) {
    changed.set(
      file.path,
      file.status === 'deleted'
        ? 'removed'
        : file.status === 'added'
          ? 'new'
          : 'changed',
    );
    if (file.status === 'renamed' && file.oldPath) {
      changed.set(file.oldPath, 'removed');
      changed.set(file.path, 'new');
    }
  }
  const all = [...graphs.base, ...graphs.head];
  const ownership = new Map(all.map((module) => [module.path, module.owner]));
  const owner = (path: string) => ownership.get(path) ?? defaultOwner(path);
  const near = new Set(changed.keys());
  for (const module of all) {
    if (changed.has(module.path))
      for (const path of module.imports) near.add(path);
    if (module.imports.some((path) => changed.has(path))) near.add(module.path);
  }
  const basePaths = new Set(graphs.base.map((m) => m.path));
  const headPaths = new Set(graphs.head.map((m) => m.path));
  const paths = [
    ...new Set(all.map((m) => m.path).concat([...changed.keys()])),
  ].filter((path) => near.has(path));
  const owners = [...new Set(paths.map(owner))].sort().map((path) => {
    const files = paths
      .filter((p) => owner(p) === path)
      .sort()
      .map((p) => ({
        path: p,
        importers: new Set(
          all
            .filter((module) => module.imports.includes(p))
            .map((module) => module.path),
        ).size,
        ...(changed.has(p) ? { change: changed.get(p) } : {}),
      }));
    const ids = review.layers
      .filter((layer) =>
        layer.steps.some((step) =>
          files.some((file) => file.path === step.pointer.path),
        ),
      )
      .map((layer) => layer.id);
    const affected = files.some((file) => file.change !== undefined);
    const base = [...basePaths].some((p) => owner(p) === path);
    const head = [...headPaths].some((p) => owner(p) === path);
    return {
      path,
      files,
      layerIds: ids,
      annotations: (review.diagram?.after.boxes ?? []).filter(
        (box) => box.layerId !== undefined && ids.includes(box.layerId),
      ),
      ...(affected
        ? {
            change:
              !base && head
                ? ('new' as const)
                : base && !head
                  ? ('removed' as const)
                  : ('changed' as const),
          }
        : {}),
    };
  });
  const edgesAt = (graph: ModuleGraph) =>
    new Set(
      graph.flatMap((m) =>
        m.imports
          .filter(
            (p) =>
              near.has(m.path) && near.has(p) && owner(m.path) !== owner(p),
          )
          .map((p) => `${owner(m.path)}\0${owner(p)}`),
      ),
    );
  const base = edgesAt(graphs.base),
    head = edgesAt(graphs.head);
  const edges = [...new Set([...base, ...head])].sort().map((key) => {
    const [from = '', to = ''] = key.split('\0');
    return {
      from,
      to,
      ...(!base.has(key)
        ? { change: 'new' as const }
        : !head.has(key)
          ? { change: 'removed' as const }
          : {}),
    };
  });
  return {
    kind: 'imports',
    owners,
    edges,
    guards: [...changed.keys()].filter(
      (path) =>
        changed.get(path) === 'new' &&
        /(?:^|\/)(?:architecture\/|[^/]*oxlint[^/]*|[^/]*eslint[^/]*|[^/]*lint-rules?\/)/.test(
          path,
        ),
    ),
    unresolved: all
      .filter((m) => near.has(m.path))
      .reduce((n, m) => n + m.unresolved, 0),
  };
}
