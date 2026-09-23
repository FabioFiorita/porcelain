import { createHash, createHmac } from 'node:crypto';
import type {
  ResolvedReviewStep,
  ReviewChange,
  ReviewDiagnostics,
  ReviewResponse,
} from '../models/published-review.ts';
import type {
  StoredReview,
  StoredReviewLayer,
  StoredReviewStep,
} from '../models/stored-review.ts';
import type { ReviewStore } from '../ports/review-store.ts';

const SUMMARY_LIFETIME_SECONDS = 60 * 60;
const IGNORABLE =
  /^\s*(?:$|import\b|export \* from|export \{[^}]*\} from|\/\/|\/\*|\*|\*\/|[)\]}]+[;,]?$)/;

export class ResolvePublishedReviewService {
  private readonly store: ReviewStore;

  constructor(store: ReviewStore) {
    this.store = store;
  }

  execute(
    stored: StoredReview,
    environmentId: string,
    files: ReadonlyMap<string, string>,
    changes?: readonly ReviewChange[],
    diagnostics?: ReviewDiagnostics,
  ): ReviewResponse {
    const changed = diagnostics?.changed ?? new Map<string, Set<number>>();
    const deleted = diagnostics?.deleted ?? new Map<string, Set<number>>();
    const binary = diagnostics?.binary ?? new Set<string>();
    const layers = stored.layers.map((layer) => {
      const steps = layer.steps.map((step) =>
        resolveStep(
          step,
          files.get(step.pointer.path),
          changed,
          changes !== undefined,
        ),
      );
      const resolvedById = new Map(steps.map((step) => [step.id, step]));
      return {
        ...withoutStoredSteps(layer),
        steps,
        fingerprint: fingerprint(
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
        ),
      };
    });
    const changedSteps = layers
      .flatMap((layer) => layer.steps)
      .filter((step) => step.kind === 'changed');
    const active =
      changedSteps.length === 0 ||
      changedSteps.some((step) => step.location.state !== 'committed');
    if (active !== stored.active)
      this.store.setActive(stored.worktreeId, stored.revision, active);
    const expires = Math.floor(Date.now() / 1000) + SUMMARY_LIFETIME_SECONDS;
    const signature = createHmac('sha256', stored.summarySecret)
      .update(`${stored.summaryToken}\0${expires}`)
      .digest('base64url');
    return {
      environmentId,
      worktreeId: stored.worktreeId,
      revision: stored.revision,
      publishedAt: stored.publishedAt,
      active,
      diagnostics: changes === undefined ? 'unavailable' : 'current',
      summary: {
        url: `/review-summaries/${encodeURIComponent(stored.summaryToken)}?${new URLSearchParams({ expires: String(expires), signature }).toString()}`,
        byteLength: Buffer.byteLength(stored.summaryHtml, 'utf8'),
      },
      ...(stored.diagram === undefined
        ? {}
        : { diagram: structuredClone(stored.diagram) }),
      layers,
      notExplained:
        changes === undefined
          ? []
          : notExplained(changes, files, changed, deleted, binary, layers),
    };
  }
}

function resolveStep(
  stored: StoredReviewStep,
  text: string | undefined,
  changed: ReadonlyMap<string, ReadonlySet<number>>,
  diagnosticsAvailable: boolean,
): ResolvedReviewStep {
  const location = findBlock(
    text === undefined ? [] : textLines(text),
    stored.published,
    stored.pointer.startLine,
  );
  const pointer = {
    ...stored.pointer,
    textFingerprint: fingerprint(stored.published.join('\n')),
  };
  if (location === undefined)
    return {
      ...withoutPublished(stored),
      pointer,
      location: { state: 'changed' },
    };
  const endLine = location + stored.published.length - 1;
  if (stored.kind === 'context' || !diagnosticsAvailable)
    return {
      ...withoutPublished(stored),
      pointer,
      location: { state: 'current', startLine: location, endLine },
    };
  const lines = changed.get(stored.pointer.path) ?? new Set<number>();
  const stillChanged = [...lines].some(
    (line) => line >= location && line <= endLine,
  );
  return {
    ...withoutPublished(stored),
    pointer,
    location: {
      state: stillChanged ? 'current' : 'committed',
      startLine: location,
      endLine,
    },
  };
}

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

function notExplained(
  changes: readonly ReviewChange[],
  files: ReadonlyMap<string, string>,
  changed: ReadonlyMap<string, ReadonlySet<number>>,
  deletedLines: ReadonlyMap<string, ReadonlySet<number>>,
  binary: ReadonlySet<string>,
  layers: ReviewResponse['layers'],
): ReviewResponse['notExplained'] {
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
  return changes.flatMap((file) => {
    if (file.deleted) return [{ path: file.path, ranges: [], deleted: true }];
    if (binary.has(file.path))
      return [{ path: file.path, ranges: [], binary: true }];
    const text = textLines(files.get(file.path) ?? '');
    const mine = covered.get(file.path) ?? new Set<number>();
    const removals = deletedLines.get(file.path) ?? new Set<number>();
    const left = [...(changed.get(file.path) ?? [])].filter((line) => {
      if (!removals.has(line) && IGNORABLE.test(text[line - 1] ?? ''))
        return false;
      const [start, end] = paragraph(text, line);
      for (let candidate = start; candidate <= end; candidate += 1)
        if (mine.has(candidate)) return false;
      return true;
    });
    return left.length === 0
      ? []
      : [{ path: file.path, ranges: contiguous(left) }];
  });
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

function textLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function withoutPublished(
  step: StoredReviewStep,
): Omit<StoredReviewStep, 'published'> {
  const { published: _published, ...result } = step;
  return result;
}

function withoutStoredSteps(
  layer: StoredReviewLayer,
): Omit<StoredReviewLayer, 'steps'> {
  const { steps: _steps, ...result } = layer;
  return result;
}
