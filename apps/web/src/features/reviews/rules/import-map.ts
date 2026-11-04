import type { ReviewRevision } from '@porcelain/client/reviews/rules';

type System = NonNullable<ReviewRevision['content']['system']>;
export function importMap(system: System, focus?: string) {
  const own = new Set(
    system.owners
      .filter((owner) => focus === undefined || owner.layerIds.includes(focus))
      .map((owner) => owner.path),
  );
  const near = new Set(own);
  if (focus !== undefined)
    for (const edge of system.edges) {
      if (own.has(edge.from)) near.add(edge.to);
      if (own.has(edge.to)) near.add(edge.from);
    }
  return {
    boxes: system.owners
      .filter((owner) => near.has(owner.path))
      .map((owner) => ({
        id: owner.path,
        label: owner.path,
        change: owner.change,
        detail:
          owner.annotations
            .map(
              (note) =>
                `${note.label}${note.detail ? ` · ${note.detail}` : ''}`,
            )
            .join(' · ') || `${owner.files.length} modules`,
        layerId:
          focus !== undefined && owner.layerIds.includes(focus)
            ? focus
            : owner.layerIds[0],
        problem:
          owner.annotations.find(
            (note) => note.decision || note.problem !== undefined,
          )?.problem ??
          (owner.annotations.some(
            (note) => note.decision || note.problem !== undefined,
          )
            ? 'Needs your decision'
            : undefined),
        decision: owner.annotations.some(
          (note) => note.decision || note.problem !== undefined,
        )
          ? (true as const)
          : undefined,
      })),
    arrows: system.edges
      .filter((edge) => near.has(edge.from) && near.has(edge.to))
      .map((edge) => ({
        ...edge,
        label:
          edge.change === 'removed'
            ? 'import removed'
            : edge.change === 'new'
              ? 'new import'
              : 'imports',
      })),
  };
}
