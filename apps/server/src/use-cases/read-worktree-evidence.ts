import { createHash } from 'node:crypto';
import type { GitDiffResult } from '@porcelain/git/dtos/git-diff';
import type {
  GitChange,
  GitOrdinaryChange,
} from '@porcelain/git/dtos/git-status';
import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import type { FileReader } from '../filesystem/interfaces/file-reader.ts';
import type { FileStamps } from '../filesystem/interfaces/file-stamps.ts';
import type {
  EvidenceComparison,
  EvidenceContent,
  ReviewEvidence,
} from '../models/review-evidence.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeChangedError } from './errors/worktree-changed-error.ts';
import { resolveCheckoutSession } from './resolve-inspection-worktree.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

const scopeOrder = {
  staged: 0,
  unstaged: 1,
  untracked: 2,
  unmerged: 3,
} as const;

/** Keep one evidence response comfortably below an unbounded multi-file read. */
export const MAX_EVIDENCE_CONTENT_BYTES = 16 * 1024 * 1024;
const MAX_CACHED_WORKTREES = 16;

/**
 * Reads the same comparisons that the review surface displays and groups them
 * by logical path. Fingerprints deliberately cover the evidence content only;
 * a status token is an observation-generation guard, not review evidence.
 */
export class ReadWorktreeEvidence {
  private readonly store: InventoryStore;
  private readonly worktrees: ResolveWorktree;
  private readonly inspection: InspectionFactory;
  private readonly files: FileReader;
  private readonly stamps: FileStamps;
  private readonly cache = new Map<string, { key: string; result: Evidence }>();

  constructor(
    store: InventoryStore,
    worktrees: ResolveWorktree,
    inspection: InspectionFactory,
    files: FileReader,
    stamps: FileStamps,
  ) {
    this.store = store;
    this.worktrees = worktrees;
    this.inspection = inspection;
    this.files = files;
    this.stamps = stamps;
  }

  async execute(
    worktreeId: string,
    session: GitSession,
    signal?: AbortSignal,
    paths?: ReadonlySet<string>,
  ): Promise<Evidence> {
    signal?.throwIfAborted();
    const { environmentId, worktree, checkout } = await resolveCheckoutSession(
      this.worktrees,
      this.store,
      session,
      worktreeId,
      signal,
    );
    const reader = this.inspection(checkout);
    const before = await reader.readStatus(signal);
    signal?.throwIfAborted();

    // Status does not change when an already modified file is edited again.
    const key = `${before.statusToken}\n${await this.stamps(
      worktree.path,
      before.changes
        .filter((change) => change.scope !== 'staged')
        .map(logicalPath),
    )}`;
    const cached = this.cache.get(worktreeId);
    if (cached?.key === key) {
      this.remember(worktreeId, cached);
      return paths
        ? {
            ...cached.result,
            evidence: cached.result.evidence.filter((entry) =>
              paths.has(entry.path),
            ),
          }
        : cached.result;
    }

    const selected = paths
      ? before.changes.filter((change) => paths.has(logicalPath(change)))
      : before.changes;
    const hasUntracked = selected.some(
      (change) => change.scope === 'untracked',
    );
    if (hasUntracked)
      await resolveReadableWorktree(this.worktrees, worktreeId, signal);

    const byPath = new Map<string, EvidenceComparison[]>();
    let evidenceBytes = 0;
    // Patches are held until bounded, so read them in limited groups.
    for (let start = 0; start < selected.length; start += 64) {
      const group = selected.slice(start, start + 64);
      const diffable = group.filter(
        (change): change is GitOrdinaryChange =>
          (change.scope === 'staged' || change.scope === 'unstaged') &&
          change.supported,
      );
      const patches = await reader.readDiffs(diffable, signal);
      const diffs = new Map(
        diffable.map((change, index) => [change, patches[index]]),
      );
      for (let offset = 0; offset < group.length; offset += 4) {
        signal?.throwIfAborted();
        const changes = group.slice(offset, offset + 4);
        const loaded = await Promise.allSettled(
          changes.map((change) =>
            this.readContent(change, worktreeId, worktree.path, diffs, signal),
          ),
        );
        for (const [index, change] of changes.entries()) {
          const result = loaded[index];
          if (!result) throw new Error('Missing evidence result');
          if (result.status === 'rejected') throw result.reason;
          const path = logicalPath(change);
          const content = boundedContent(result.value, evidenceBytes);
          if (content === result.value)
            evidenceBytes += contentByteLength(content);
          const comparisons = byPath.get(path) ?? [];
          comparisons.push({ change, content });
          byPath.set(path, comparisons);
        }
      }
    }

    const after = await reader.readStatus(signal);
    signal?.throwIfAborted();
    if (after.statusToken !== before.statusToken)
      throw new WorktreeChangedError();

    const evidence: ReviewEvidence[] = [...byPath.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, comparisons]) => {
        const ordered = comparisons.toSorted(compareEvidence);
        return {
          path,
          fingerprint: fingerprint(path, ordered),
          comparisons: ordered,
        };
      });

    const result = {
      environmentId,
      worktreeId,
      statusToken: before.statusToken,
      evidence,
    };
    // The result is about to outlive this request, so confirm the checkout is
    // still the one it was read from before it is kept.
    if (!paths) {
      await checkout.confirm(signal);
      this.remember(worktreeId, { key, result });
    }
    return result;
  }

  private remember(
    worktreeId: string,
    entry: { key: string; result: Evidence },
  ) {
    this.cache.delete(worktreeId);
    this.cache.set(worktreeId, entry);
    const oldest = this.cache.keys().next().value;
    if (this.cache.size > MAX_CACHED_WORKTREES && oldest !== undefined)
      this.cache.delete(oldest);
  }

  private async readContent(
    change: GitChange,
    worktreeId: string,
    root: string,
    diffs: ReadonlyMap<GitChange, GitDiffResult | undefined>,
    signal?: AbortSignal,
  ): Promise<EvidenceContent> {
    if (change.scope === 'unmerged')
      return { kind: 'omitted', reason: 'conflict' };
    if (change.scope === 'untracked') {
      try {
        const content = await this.files.read(
          { worktreeId, root, path: change.path },
          signal,
        );
        return { kind: 'file', ...content };
      } catch (error) {
        signal?.throwIfAborted();
        if (!(error instanceof FileInspectionError)) throw error;
        return { kind: 'omitted', reason: fileErrorReason(error.code) };
      }
    }
    if (!change.supported)
      return { kind: 'omitted', reason: 'unsupported-git-entry' };

    const content = diffs.get(change);
    if (!content) throw new Error('Missing diff result');
    return { kind: 'diff', content };
  }
}

type Evidence = {
  environmentId: string;
  worktreeId: string;
  statusToken: string;
  evidence: ReviewEvidence[];
};

function boundedContent(content: EvidenceContent, usedBytes: number) {
  const size = contentByteLength(content);
  if (
    size > 0 &&
    (usedBytes > MAX_EVIDENCE_CONTENT_BYTES - size ||
      size > MAX_EVIDENCE_CONTENT_BYTES)
  )
    return { kind: 'omitted', reason: 'size-limit' } as const;
  return content;
}

function contentByteLength(content: EvidenceContent) {
  if (content.kind === 'file') return Buffer.byteLength(content.text, 'utf8');
  if (content.kind !== 'diff') return 0;
  if (
    content.content.kind === 'text' ||
    content.content.kind === 'metadata-only'
  )
    return Buffer.byteLength(content.content.patch, 'utf8');
  return 0;
}

function logicalPath(change: GitChange) {
  if ('path' in change) return change.path;
  return change.newPath ?? change.oldPath ?? '';
}

function compareEvidence(left: EvidenceComparison, right: EvidenceComparison) {
  const scopeDifference =
    scopeOrder[left.change.scope] - scopeOrder[right.change.scope];
  if (scopeDifference !== 0) return scopeDifference;
  return logicalPath(left.change).localeCompare(logicalPath(right.change));
}

function fingerprint(path: string, comparisons: readonly EvidenceComparison[]) {
  if (comparisons.some((comparison) => !isFingerprintable(comparison.content)))
    return null;
  return createHash('sha256')
    .update(
      JSON.stringify({
        path,
        comparisons: comparisons.map(canonicalComparison),
      }),
    )
    .digest('hex');
}

function isFingerprintable(content: EvidenceContent) {
  if (content.kind === 'file') return true;
  return (
    content.kind === 'diff' &&
    (content.content.kind === 'text' ||
      content.content.kind === 'metadata-only')
  );
}

function canonicalComparison(comparison: EvidenceComparison) {
  const { change, content } = comparison;
  return {
    change: canonicalChange(change),
    content:
      content.kind === 'diff'
        ? { kind: 'diff', content: content.content }
        : content.kind === 'file'
          ? {
              kind: 'file',
              encoding: content.encoding,
              byteLength: content.byteLength,
              text: content.text,
            }
          : { kind: 'omitted', reason: content.reason },
  };
}

function canonicalChange(change: GitChange) {
  if (change.scope === 'untracked')
    return { scope: change.scope, path: change.path };
  if (change.scope === 'unmerged')
    return {
      scope: change.scope,
      path: change.path,
      conflict: change.conflict,
    };
  return {
    scope: change.scope,
    kind: change.kind,
    oldPath: change.oldPath,
    newPath: change.newPath,
    oldMode: change.oldMode,
    newMode: change.newMode,
    supported: change.supported,
  } satisfies GitOrdinaryChange;
}

function fileErrorReason(code: FileInspectionError['code']) {
  if (code === 'FILE_TOO_LARGE') return 'size-limit' as const;
  if (code === 'UNSUPPORTED_TEXT') return 'unsupported-encoding' as const;
  if (code === 'CONTENT_CHANGED') return 'content-changed' as const;
  return 'unreadable' as const;
}
