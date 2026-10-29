import { decisionKey } from '@porcelain/client/reviews/rules';

export function retainedDiffPaths(file: {
  path: string;
  oldPath?: string | undefined;
  newPath?: string | undefined;
}) {
  return [
    ...new Set(
      [file.oldPath, file.newPath, file.path].filter(
        (path) => path !== undefined,
      ),
    ),
  ];
}

export function reviewFilePosition(
  layers: readonly {
    id: string;
    steps: readonly { id: string; pointer: { path: string } }[];
  }[],
  path: string,
  stepId: string | undefined,
  place: string,
) {
  const positions = layers.flatMap((layer, decision) =>
    layer.steps.flatMap((step, stop) =>
      step.pointer.path === path
        ? [{ decision, stop, stepId: step.id, place: decisionKey(layer.id) }]
        : [],
    ),
  );
  return (
    positions.find((position) => position.stepId === stepId) ??
    positions.find((position) => position.place === place) ??
    positions[0]
  );
}
