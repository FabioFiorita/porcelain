import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { ChangeList } from '../models/change.ts';
import type {
  PublishReview,
  ReviewResponse,
  ReviewStep,
  StoredReview,
  StoredReviewLayer,
  StoredReviewStep,
} from '../models/review.ts';
import type { ReviewStore } from '../repositories/interfaces/review-store.ts';
import type { ReadChangeDiffs } from './read-change-diffs.ts';
import type { ReadTextFile } from './read-text-file.ts';
import type { ReadWorktreeChanges } from './read-worktree-changes.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

const SUMMARY_LIFETIME_SECONDS = 60 * 60;
const IGNORABLE =
  /^\s*(?:$|import\b|export \* from|export \{[^}]*\} from|\/\/|\/\*|\*|\*\/|[)\]}]+[;,]?$)/;

export class PublishedReview {
  private readonly store: ReviewStore;
  private readonly worktrees: ResolveWorktree;
  private readonly text: ReadTextFile;
  private readonly changes: ReadWorktreeChanges;
  private readonly diffs: ReadChangeDiffs;
  private readonly environmentId: () => string;
  private readonly session: () => GitSession;
  private readonly now: () => string;
  constructor(
    store: ReviewStore,
    worktrees: ResolveWorktree,
    text: ReadTextFile,
    changes: ReadWorktreeChanges,
    diffs: ReadChangeDiffs,
    environmentId: () => string,
    session: () => GitSession,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.store = store;
    this.worktrees = worktrees;
    this.text = text;
    this.changes = changes;
    this.diffs = diffs;
    this.environmentId = environmentId;
    this.session = session;
    this.now = now;
  }

  async publish(
    worktreeId: string,
    input: PublishReview,
    signal?: AbortSignal,
  ): Promise<ReviewResponse> {
    await this.worktrees.forWriting(worktreeId, signal);
    const layers: StoredReviewLayer[] = [];
    for (const layer of input.layers) {
      const steps: StoredReviewStep[] = [];
      for (const step of layer.steps) {
        let published: string[] = [];
        try {
          const file = await this.text.execute(
            worktreeId,
            step.pointer.path,
            signal,
          );
          const lines = textLines(file.text);
          if (step.pointer.endLine <= lines.length)
            published = lines.slice(
              step.pointer.startLine - 1,
              step.pointer.endLine,
            );
        } catch (error) {
          if (signal?.aborted) throw error;
        }
        steps.push({ ...structuredClone(step), published });
      }
      layers.push({
        ...structuredClone(layer),
        steps,
        fingerprint: fingerprint(
          steps
            .filter((step) => step.kind === 'changed')
            .map((step) => `${step.id}:${step.published.join('\n')}`)
            .join('\0'),
        ),
      });
    }
    const stored: StoredReview = {
      worktreeId,
      revision: input.expectedRevision + 1,
      publishedAt: this.now(),
      active: true,
      summaryHtml: input.summaryHtml,
      summaryToken: randomUUID(),
      summarySecret: randomBytes(32).toString('hex'),
      ...(input.diagram === undefined
        ? {}
        : { diagram: structuredClone(input.diagram) }),
      layers,
    };
    this.store.replace(stored, input.expectedRevision);
    return this.resolve(stored, signal);
  }

  async read(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ReviewResponse | null> {
    await this.worktrees.known(worktreeId, signal);
    const stored = this.store.read(worktreeId);
    return stored === null ? null : this.resolve(stored, signal);
  }

  summary(token: string) {
    return this.store.readSummary(token);
  }

  private async resolve(
    stored: StoredReview,
    signal?: AbortSignal,
  ): Promise<ReviewResponse> {
    const paths = [
      ...new Set(
        stored.layers.flatMap((layer) =>
          layer.steps.map((step) => step.pointer.path),
        ),
      ),
    ];
    const files = new Map<string, string>();
    await Promise.all(
      paths.map(async (path) => {
        try {
          files.set(
            path,
            (await this.text.execute(stored.worktreeId, path, signal)).text,
          );
        } catch (error) {
          if (signal?.aborted) throw error;
        }
      }),
    );

    let changeList: ChangeList | null = null;
    let changed = new Map<string, Set<number>>();
    let deletedLines = new Map<string, Set<number>>();
    let binary = new Set<string>();
    try {
      changeList = await this.changes.execute(
        stored.worktreeId,
        this.session(),
        signal,
      );
      await Promise.all(
        changeList.changes.map(async ({ path }) => {
          if (files.has(path)) return;
          try {
            files.set(
              path,
              (await this.text.execute(stored.worktreeId, path, signal)).text,
            );
          } catch (error) {
            if (signal?.aborted) throw error;
          }
        }),
      );
      const diagnostics = await this.changedLines(changeList, files, signal);
      changed = diagnostics.changed;
      deletedLines = diagnostics.deleted;
      binary = diagnostics.binary;
    } catch (error) {
      if (signal?.aborted) throw error;
      changeList = null;
      changed = new Map();
    }

    const layers = stored.layers.map((layer) => {
      const steps = layer.steps.map((step) =>
        resolveStep(step, files.get(step.pointer.path), changed, changeList),
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
    const signature = signSummary(
      stored.summarySecret,
      stored.summaryToken,
      expires,
    );
    return {
      environmentId: this.environmentId(),
      worktreeId: stored.worktreeId,
      revision: stored.revision,
      publishedAt: stored.publishedAt,
      active,
      diagnostics: changeList === null ? 'unavailable' : 'current',
      summary: {
        url: `/review-summaries/${encodeURIComponent(stored.summaryToken)}?${new URLSearchParams({ expires: String(expires), signature })}`,
        byteLength: Buffer.byteLength(stored.summaryHtml, 'utf8'),
      },
      ...(stored.diagram === undefined
        ? {}
        : { diagram: structuredClone(stored.diagram) }),
      layers,
      notExplained:
        changeList === null
          ? []
          : notExplained(
              changeList,
              files,
              changed,
              deletedLines,
              binary,
              layers,
            ),
    };
  }

  private async changedLines(
    list: ChangeList,
    files: ReadonlyMap<string, string>,
    signal?: AbortSignal,
  ) {
    const changed = new Map<string, Set<number>>();
    const binary = new Set<string>();
    const deleted = new Map<string, Set<number>>();
    const staged = new Map<string, Set<number>>();
    const stagedDeleted = new Map<string, Set<number>>();
    const unstagedPatches = new Map<string, string>();
    const selections = list.changes.flatMap((file) =>
      file.comparisons.filter(
        (
          entry,
        ): entry is Extract<typeof entry, { scope: 'staged' | 'unstaged' }> =>
          entry.scope === 'staged' || entry.scope === 'unstaged',
      ),
    );
    for (const file of list.changes) {
      if (file.comparisons.some((entry) => entry.scope === 'untracked'))
        changed.set(
          file.path,
          new Set(
            textLines(files.get(file.path) ?? '').map((_, index) => index + 1),
          ),
        );
    }
    for (let offset = 0; offset < selections.length; offset += 200) {
      const batch = selections.slice(offset, offset + 200);
      const selectedPaths = new Set(
        batch
          .map((entry) => entry.newPath ?? entry.oldPath)
          .filter((path): path is string => path !== null),
      );
      const expectedFiles = list.changes
        .filter((file) => selectedPaths.has(file.path))
        .map((file) => ({ path: file.path, fingerprint: file.fingerprint }));
      const answer = await this.diffs.execute(
        list.worktreeId,
        list.statusToken,
        expectedFiles,
        batch,
        this.session(),
        signal,
      );
      for (const entry of answer.diffs) {
        const path = entry.selection.newPath ?? entry.selection.oldPath;
        if (path === null) continue;
        if (
          entry.content.kind === 'binary' ||
          entry.content.kind === 'omitted'
        ) {
          binary.add(path);
          continue;
        }
        if (entry.selection.scope === 'staged') {
          const lines = staged.get(path) ?? new Set<number>();
          const patch = patchLineChanges(entry.content.patch);
          for (const line of patch.changed) lines.add(line);
          staged.set(path, lines);
          const removals = stagedDeleted.get(path) ?? new Set<number>();
          for (const line of patch.deleted) removals.add(line);
          stagedDeleted.set(path, removals);
        } else {
          unstagedPatches.set(path, entry.content.patch);
          const lines = changed.get(path) ?? new Set<number>();
          const patch = patchLineChanges(entry.content.patch);
          for (const line of patch.changed) lines.add(line);
          changed.set(path, lines);
          const removals = deleted.get(path) ?? new Set<number>();
          for (const line of patch.deleted) removals.add(line);
          deleted.set(path, removals);
        }
      }
    }
    for (const [path, lines] of staged) {
      const destination = changed.get(path) ?? new Set<number>();
      const unstaged = unstagedPatches.get(path);
      for (const line of lines) {
        const mapped =
          unstaged === undefined ? line : mapOldLine(unstaged, line);
        if (mapped !== null) destination.add(mapped);
      }
      changed.set(path, destination);
      const removals = deleted.get(path) ?? new Set<number>();
      for (const line of stagedDeleted.get(path) ?? []) {
        const mapped =
          unstaged === undefined ? line : mapOldLine(unstaged, line);
        if (mapped !== null) removals.add(mapped);
      }
      deleted.set(path, removals);
    }
    return { changed, deleted, binary };
  }
}

export function verifySummarySignature(
  secret: string,
  token: string,
  expires: number,
  signature: string,
) {
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000))
    return false;
  const expected = Buffer.from(signSummary(secret, token, expires));
  const supplied = Buffer.from(signature);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

function signSummary(secret: string, token: string, expires: number) {
  return createHmac('sha256', secret)
    .update(`${token}\0${expires}`)
    .digest('base64url');
}

function resolveStep(
  stored: StoredReviewStep,
  text: string | undefined,
  changed: ReadonlyMap<string, Set<number>>,
  changes: ChangeList | null,
): ReviewStep {
  const location = findBlock(
    text === undefined ? [] : textLines(text),
    stored.published,
    stored.pointer.startLine,
  );
  const pointer = {
    ...stored.pointer,
    textFingerprint: fingerprint(stored.published.join('\n')),
  };
  if (location === null)
    return {
      ...withoutPublished(stored),
      pointer,
      location: { state: 'changed' },
    };
  const endLine = location + stored.published.length - 1;
  if (stored.kind === 'context' || changes === null)
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
) {
  if (block.length === 0) return null;
  let best: number | null = null;
  for (let index = 0; index + block.length <= lines.length; index += 1) {
    if (!block.every((line, offset) => line === lines[index + offset]))
      continue;
    const candidate = index + 1;
    if (best === null || Math.abs(candidate - near) < Math.abs(best - near))
      best = candidate;
  }
  return best;
}

function patchLineChanges(patch: string) {
  const changed = new Set<number>();
  const deleted = new Set<number>();
  let line = 0;
  for (const value of patch.split('\n')) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(value);
    if (header) {
      line = Number(header[1]);
    } else if (value.startsWith('+') && !value.startsWith('+++')) {
      changed.add(Math.max(1, line));
      line += 1;
    } else if (value.startsWith('-') && !value.startsWith('---')) {
      const at = Math.max(1, line);
      changed.add(at);
      deleted.add(at);
    } else if (value.startsWith(' ')) {
      line += 1;
    }
  }
  return { changed, deleted };
}

export function mapOldLine(patch: string, target: number): number | null {
  let oldLine = 1;
  let newLine = 1;
  for (const value of patch.split('\n')) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(value);
    if (header) {
      const oldCount = header[2] === undefined ? 1 : Number(header[2]);
      const newCount = header[4] === undefined ? 1 : Number(header[4]);
      const nextOld = Number(header[1]) + (oldCount === 0 ? 1 : 0);
      const nextNew = Number(header[3]) + (newCount === 0 ? 1 : 0);
      if (target < nextOld) return target + (newLine - oldLine);
      oldLine = nextOld;
      newLine = nextNew;
    } else if (value.startsWith('-') && !value.startsWith('---')) {
      if (target === oldLine) return null;
      oldLine += 1;
    } else if (value.startsWith('+') && !value.startsWith('+++')) {
      newLine += 1;
    } else if (value.startsWith(' ')) {
      if (target === oldLine) return newLine;
      oldLine += 1;
      newLine += 1;
    }
  }
  return target + (newLine - oldLine);
}

function notExplained(
  list: ChangeList,
  files: ReadonlyMap<string, string>,
  changed: ReadonlyMap<string, Set<number>>,
  deletedLines: ReadonlyMap<string, Set<number>>,
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
  return list.changes.flatMap((file) => {
    const deleted = file.comparisons.some(
      (entry) =>
        (entry.scope === 'staged' || entry.scope === 'unstaged') &&
        entry.newPath === null,
    );
    if (deleted) return [{ path: file.path, ranges: [], deleted: true }];
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

function contiguous(values: readonly number[]) {
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

function textLines(text: string) {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function withoutPublished(step: StoredReviewStep) {
  const { published: _published, ...result } = step;
  return result;
}

function withoutStoredSteps(layer: StoredReviewLayer) {
  const { steps: _steps, ...result } = layer;
  return result;
}
