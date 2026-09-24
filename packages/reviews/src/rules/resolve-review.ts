import { sha256Hex } from '@porcelain/kernel/rules';
import type {
  ResolvedLayer,
  ResolvedStep,
  UnexplainedChange,
} from '../models/resolved-review.ts';
import type {
  ReviewChange,
  ReviewDiagnostics,
  ReviewFiles,
} from '../models/review-evidence.ts';
import type { ReviewLayer, ReviewStep } from '../models/review.ts';
import { textLines } from './review-evidence.ts';

const IGNORABLE =
  /^\s*(?:$|import\b|export \* from|export \{[^}]*\} from|\/\/|\/\*|\*|\*\/|[)\]}]+[;,]?$)/;

function findBlock(
  lines: readonly string[],
  block: readonly string[],
  near: number,
): number | undefined {
  if (block.length === 0) return undefined;
  let best: number | undefined;
  for (let index = 0; index + block.length <= lines.length; index += 1) {
    if (!block.every((line, offset) => line === lines[index + offset]))
      continue;
    const candidate = index + 1;
    if (
      best === undefined ||
      Math.abs(candidate - near) < Math.abs(best - near)
    )
      best = candidate;
  }
  return best;
}

export function resolveStep(
  step: ReviewStep,
  files: ReviewFiles,
  changed: ReadonlyMap<string, ReadonlySet<number>> | undefined,
): ResolvedStep {
  const { published, ...draft } = step;
  const text = files.get(step.pointer.path);
  const start = findBlock(
    text === undefined ? [] : textLines(text),
    published,
    step.pointer.startLine,
  );
  const pointer = {
    ...step.pointer,
    textFingerprint: sha256Hex(published.join('\n')),
  };
  if (start === undefined)
    return { ...draft, pointer, location: { state: 'changed' } };
  const endLine = start + published.length - 1;
  if (step.kind === 'context' || changed === undefined)
    return {
      ...draft,
      pointer,
      location: { state: 'current', startLine: start, endLine },
    };
  const stillChanged = [...(changed.get(step.pointer.path) ?? [])].some(
    (line) => line >= start && line <= endLine,
  );
  return {
    ...draft,
    pointer,
    location: {
      state: stillChanged ? 'current' : 'committed',
      startLine: start,
      endLine,
    },
  };
}

function resolvedFingerprint(
  layer: ReviewLayer,
  steps: readonly ResolvedStep[],
  files: ReviewFiles,
): string {
  const resolvedById = new Map(steps.map((step) => [step.id, step]));
  return sha256Hex(
    layer.steps
      .filter((step) => step.kind === 'changed')
      .map((step) => {
        const location = resolvedById.get(step.id)?.location;
        if (!location || location.state === 'changed')
          return `${step.id}:changed`;
        const lines = textLines(files.get(step.pointer.path) ?? '');
        return `${step.id}:${lines.slice(location.startLine - 1, location.endLine).join('\n')}`;
      })
      .join('\0'),
  );
}

export function resolveLayer(
  layer: ReviewLayer,
  files: ReviewFiles,
  changed: ReadonlyMap<string, ReadonlySet<number>> | undefined,
): ResolvedLayer {
  const steps = layer.steps.map((step) => resolveStep(step, files, changed));
  const { steps: _published, ...rest } = layer;
  return {
    ...rest,
    steps,
    fingerprint: resolvedFingerprint(layer, steps, files),
  };
}

export function currentLayerFingerprint(
  layer: ReviewLayer,
  files: ReviewFiles,
): string {
  return resolveLayer(layer, files, undefined).fingerprint;
}

export function publishedLayerFingerprint(
  steps: readonly ReviewStep[],
): string {
  return sha256Hex(
    steps
      .filter((step) => step.kind === 'changed')
      .map((step) => `${step.id}:${step.published.join('\n')}`)
      .join('\0'),
  );
}

export function reviewIsActive(layers: readonly ResolvedLayer[]): boolean {
  const changedSteps = layers
    .flatMap((layer) => layer.steps)
    .filter((step) => step.kind === 'changed');
  return (
    changedSteps.length === 0 ||
    changedSteps.some((step) => step.location.state !== 'committed')
  );
}

function contiguous(values: readonly number[]): {
  startLine: number;
  endLine: number;
}[] {
  const result: { startLine: number; endLine: number }[] = [];
  for (const line of [...values].sort((a, b) => a - b)) {
    const last = result.at(-1);
    if (last && line === last.endLine + 1) last.endLine = line;
    else result.push({ startLine: line, endLine: line });
  }
  return result;
}

function paragraph(lines: readonly string[], line: number): [number, number] {
  let start = line;
  let end = line;
  while (start > 1 && (lines[start - 2] ?? '').trim() !== '') start -= 1;
  while (end < lines.length && (lines[end] ?? '').trim() !== '') end += 1;
  return [start, end];
}

function coveredLines(
  layers: readonly ResolvedLayer[],
): Map<string, Set<number>> {
  const covered = new Map<string, Set<number>>();
  for (const step of layers.flatMap((layer) => layer.steps)) {
    if (step.kind !== 'changed' || step.location.state === 'changed') continue;
    const lines = covered.get(step.pointer.path) ?? new Set<number>();
    for (
      let line = step.location.startLine;
      line <= step.location.endLine;
      line += 1
    )
      lines.add(line);
    covered.set(step.pointer.path, lines);
  }
  return covered;
}

export function unexplainedChanges(
  changes: readonly ReviewChange[],
  files: ReviewFiles,
  diagnostics: ReviewDiagnostics,
  layers: readonly ResolvedLayer[],
): UnexplainedChange[] {
  const covered = coveredLines(layers);
  return changes.flatMap((file): UnexplainedChange[] => {
    if (file.deleted) return [{ path: file.path, ranges: [], deleted: true }];
    if (diagnostics.binary.has(file.path))
      return [{ path: file.path, ranges: [], binary: true }];
    const text = textLines(files.get(file.path) ?? '');
    const mine = covered.get(file.path) ?? new Set<number>();
    const removals = diagnostics.deleted.get(file.path) ?? new Set<number>();
    const left = [...(diagnostics.changed.get(file.path) ?? [])].filter(
      (line) => {
        if (!removals.has(line) && IGNORABLE.test(text[line - 1] ?? ''))
          return false;
        const [start, end] = paragraph(text, line);
        for (let candidate = start; candidate <= end; candidate += 1)
          if (mine.has(candidate)) return false;
        return true;
      },
    );
    return left.length === 0
      ? []
      : [{ path: file.path, ranges: contiguous(left) }];
  });
}
