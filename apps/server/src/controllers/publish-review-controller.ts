import type {
  ChangeComparison,
  ReadChangesResult,
} from '@porcelain/changes/models';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { ReviewResponse } from '@porcelain/contracts/reviews';
import type {
  ReviewPatch,
  ReviewPublication,
  StoredReview,
} from '@porcelain/reviews/models';
import {
  AssembleReviewDiagnosticsService,
  PublishReviewService,
  ResolvePublishedReviewService,
} from '@porcelain/reviews/services';
import {
  reviewChanges,
  reviewPatches,
  type ReviewEvidenceReader,
} from '../runtime/review-evidence.ts';

type RunForWorktree = <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

type ReviewWorktreeAccess = {
  forWriting(worktreeId: string, signal?: AbortSignal): Promise<unknown>;
};

export class PublishReviewController {
  private readonly worktrees: ReviewWorktreeAccess;
  private readonly publish: PublishReviewService;
  private readonly text: ReadTextFileService;
  private readonly evidence: ReviewEvidenceReader;
  private readonly diagnostics: AssembleReviewDiagnosticsService;
  private readonly resolve: ResolvePublishedReviewService;
  private readonly environmentId: () => string;
  private readonly runForWorktree: RunForWorktree;
  private readonly publishChanged: (worktreeId: string) => void;

  constructor(
    worktrees: ReviewWorktreeAccess,
    publish: PublishReviewService,
    text: ReadTextFileService,
    evidence: ReviewEvidenceReader,
    diagnostics: AssembleReviewDiagnosticsService,
    resolve: ResolvePublishedReviewService,
    environmentId: () => string,
    runForWorktree: RunForWorktree,
    publishChanged: (worktreeId: string) => void,
  ) {
    this.worktrees = worktrees;
    this.publish = publish;
    this.text = text;
    this.evidence = evidence;
    this.diagnostics = diagnostics;
    this.resolve = resolve;
    this.environmentId = environmentId;
    this.runForWorktree = runForWorktree;
    this.publishChanged = publishChanged;
  }

  execute(
    input: { worktreeId: string; review: ReviewPublication },
    context: { signal?: AbortSignal | undefined },
  ): Promise<ReviewResponse> {
    const { worktreeId } = input;
    return this.runForWorktree(async (signal) => {
      await this.worktrees.forWriting(worktreeId, signal);
      const published: string[][][] = [];
      for (const layer of input.review.layers) {
        const steps: string[][] = [];
        for (const step of layer.steps) {
          let lines: string[] = [];
          try {
            const file = await this.text.execute(
              worktreeId,
              step.pointer.path,
              signal,
            );
            const content = textLines(file.text);
            if (step.pointer.endLine <= content.length)
              lines = content.slice(
                step.pointer.startLine - 1,
                step.pointer.endLine,
              );
          } catch (error) {
            if (signal?.aborted) throw error;
          }
          steps.push(lines);
        }
        published.push(steps);
      }
      const stored = this.publish.execute(worktreeId, input.review, published);
      const files = await this.readStoredFiles(stored, signal);
      let current: ReadChangesResult | undefined;
      let patches: ReviewPatch[] = [];
      try {
        current = await this.evidence.readChanges(worktreeId, signal);
        await this.readChangedFiles(current, files, signal);
        patches = await this.readPatches(current, signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        current = undefined;
        patches = [];
      }
      const changes =
        current === undefined ? undefined : reviewChanges(current);
      const diagnostics =
        changes === undefined
          ? undefined
          : this.diagnostics.execute(changes, files, patches);
      return this.resolve.execute(
        stored,
        this.environmentId(),
        files,
        changes,
        diagnostics,
      );
    }, context.signal).then((answer) => {
      this.publishChanged(worktreeId);
      return answer;
    });
  }

  private async readStoredFiles(
    stored: StoredReview,
    signal?: AbortSignal,
  ): Promise<Map<string, string>> {
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
    return files;
  }

  private async readChangedFiles(
    current: ReadChangesResult,
    files: Map<string, string>,
    signal?: AbortSignal,
  ): Promise<void> {
    await Promise.all(
      current.changes.map(async ({ path }) => {
        if (files.has(path)) return;
        try {
          files.set(
            path,
            (await this.text.execute(current.worktreeId, path, signal)).text,
          );
        } catch (error) {
          if (signal?.aborted) throw error;
        }
      }),
    );
  }

  private async readPatches(
    current: ReadChangesResult,
    signal?: AbortSignal,
  ): Promise<ReviewPatch[]> {
    const selections = current.changes.flatMap((file) =>
      file.comparisons.filter(
        (
          entry,
        ): entry is Extract<
          ChangeComparison,
          { scope: 'staged' | 'unstaged' }
        > => entry.scope === 'staged' || entry.scope === 'unstaged',
      ),
    );
    const patches: ReviewPatch[] = [];
    for (let offset = 0; offset < selections.length; offset += 200) {
      const batch = selections.slice(offset, offset + 200);
      const selectedPaths = new Set(
        batch
          .map((entry) => entry.newPath ?? entry.oldPath)
          .filter((path): path is string => path !== null),
      );
      const expectedFiles = current.changes
        .filter((file) => selectedPaths.has(file.path))
        .map((file) => ({ path: file.path, fingerprint: file.fingerprint }));
      patches.push(
        ...reviewPatches(
          await this.evidence.readDiffs(
            current.worktreeId,
            current.statusToken,
            expectedFiles,
            batch,
            signal,
          ),
        ),
      );
    }
    return patches;
  }
}

function textLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}
