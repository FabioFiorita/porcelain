import { createHash } from 'node:crypto';
import type {
  GitChange,
  GitOrdinaryChange,
} from '@porcelain/git/dtos/git-status';
import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import type { FileReader } from '../filesystem/interfaces/file-reader.ts';
import type {
  EvidenceComparison,
  EvidenceContent,
  ReviewEvidence,
} from '../models/review-evidence.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeChangedError } from './errors/worktree-changed-error.ts';
import { resolveInspectionWorktree } from './resolve-inspection-worktree.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';

const scopeOrder = {
  staged: 0,
  unstaged: 1,
  untracked: 2,
  unmerged: 3,
} as const;

/** Keep one evidence response comfortably below an unbounded multi-file read. */
export const MAX_EVIDENCE_CONTENT_BYTES = 16 * 1024 * 1024;

/**
 * Reads the same comparisons that the review surface displays and groups them
 * by logical path. Fingerprints deliberately cover the evidence content only;
 * a status token is an observation-generation guard, not review evidence.
 */
export class ReadWorktreeEvidence {
  private readonly store: InventoryStore;
  private readonly inspection: InspectionFactory;
  private readonly git: GitFactory;
  private readonly files: FileReader;

  constructor(
    store: InventoryStore,
    inspection: InspectionFactory,
    git: GitFactory,
    files: FileReader,
  ) {
    this.store = store;
    this.inspection = inspection;
    this.git = git;
    this.files = files;
  }

  async execute(
    worktreeId: string,
    signal?: AbortSignal,
    paths?: ReadonlySet<string>,
  ) {
    signal?.throwIfAborted();
    const { environmentId, worktree, metadataIdentity, repositoryIdentity } =
      resolveInspectionWorktree(this.store, worktreeId);
    const reader = this.inspection(
      worktree.path,
      metadataIdentity,
      repositoryIdentity,
    );
    const before = await reader.readStatus(signal);
    signal?.throwIfAborted();

    const selected = paths
      ? before.changes.filter((change) => paths.has(logicalPath(change)))
      : before.changes;
    const hasUntracked = selected.some(
      (change) => change.scope === 'untracked',
    );
    if (hasUntracked)
      await resolveReadableWorktree(this.store, this.git, worktreeId, signal);

    const byPath = new Map<string, EvidenceComparison[]>();
    let evidenceBytes = 0;
    for (let offset = 0; offset < selected.length; offset += 4) {
      signal?.throwIfAborted();
      const changes = selected.slice(offset, offset + 4);
      const loaded = await Promise.allSettled(
        changes.map((change) =>
          this.readContent(change, worktreeId, worktree.path, reader, signal),
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

    return {
      environmentId,
      worktreeId,
      statusToken: before.statusToken,
      evidence,
    };
  }

  private async readContent(
    change: GitChange,
    worktreeId: string,
    root: string,
    reader: ReturnType<InspectionFactory>,
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

    const content = await reader.readDiff(change, signal);
    return { kind: 'diff', content };
  }
}

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
