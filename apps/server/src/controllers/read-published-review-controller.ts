import type {
  ChangeComparison,
  ReadChangesResult,
} from '@porcelain/changes/models';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { ReviewResponse } from '@porcelain/contracts/reviews';
import type { ReviewPatch, StoredReview } from '@porcelain/reviews/models';
import {
  AssembleReviewDiagnosticsService,
  ReadPublishedReviewService,
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
  known(worktreeId: string, signal?: AbortSignal): Promise<unknown>;
};

export class ReadPublishedReviewController {
  private readonly worktrees: ReviewWorktreeAccess;
  private readonly read: ReadPublishedReviewService;
  private readonly text: ReadTextFileService;
  private readonly evidence: ReviewEvidenceReader;
  private readonly diagnostics: AssembleReviewDiagnosticsService;
  private readonly resolve: ResolvePublishedReviewService;
  private readonly environmentId: () => string;
  private readonly runForWorktree: RunForWorktree;

  constructor(
    worktrees: ReviewWorktreeAccess,
    read: ReadPublishedReviewService,
    text: ReadTextFileService,
    evidence: ReviewEvidenceReader,
    diagnostics: AssembleReviewDiagnosticsService,
    resolve: ResolvePublishedReviewService,
    environmentId: () => string,
    runForWorktree: RunForWorktree,
  ) {
    this.worktrees = worktrees;
    this.read = read;
    this.text = text;
    this.evidence = evidence;
    this.diagnostics = diagnostics;
    this.resolve = resolve;
    this.environmentId = environmentId;
    this.runForWorktree = runForWorktree;
  }

  execute(
    input: { worktreeId: string },
    context: { signal?: AbortSignal | undefined },
  ): Promise<ReviewResponse | null> {
    const { worktreeId } = input;
    return this.runForWorktree(async (signal) => {
      await this.worktrees.known(worktreeId, signal);
      const stored = this.read.execute(worktreeId);
      if (stored === undefined) return null;
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
    }, context.signal);
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
