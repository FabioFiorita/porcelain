import { ConnectionError } from '@porcelain/client/errors/connection-error';
import type {
  Change,
  EvidenceResponse,
  ReviewedMark,
} from '../../domain/review';
import type { createMockStore } from '../inventory/mock';
import type { ReviewPort, ReviewRequest } from './port';

export function createReviewMock(
  store: ReturnType<typeof createMockStore>,
): ReviewPort {
  async function context(request: ReviewRequest) {
    request.signal.throwIfAborted();
    if (store.delayMs)
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(request.signal.reason);
        };
        const timer = setTimeout(() => {
          request.signal.removeEventListener('abort', abort);
          resolve();
        }, store.delayMs);
        request.signal.addEventListener('abort', abort, { once: true });
      });
    request.signal.throwIfAborted();
    const project = store.inventory.projects.find(
      (item) => item.id === request.projectId,
    );
    if (
      !request.token ||
      store.rejected ||
      !project?.worktrees.some((item) => item.id === request.worktreeId)
    )
      throw new ConnectionError('Review context is unavailable.');
    if (store.reviewFailed)
      throw new ConnectionError(
        'This review surface could not be loaded. Refresh and try again.',
      );
    const fixture = store.review[request.worktreeId];
    if (!fixture) throw new ConnectionError('Review context is unavailable.');
    return structuredClone(fixture);
  }
  return {
    async commitLayers(request) {
      await context(request);
      return null;
    },
    async summary(request) {
      const data = await context(request);
      const observed = mockEvidence(request.worktreeId, data);
      const marks = new Map(
        (store.reviewed[request.worktreeId] ?? []).map((mark) => [
          mark.path,
          mark.fingerprint,
        ]),
      );
      return {
        worktreeId: request.worktreeId,
        pendingFiles: observed.evidence.filter(
          (entry) =>
            entry.fingerprint === null ||
            marks.get(entry.path) !== entry.fingerprint,
        ).length,
        openThreads: (store.comments[request.worktreeId] ?? []).filter(
          (thread) => !thread.resolved,
        ).length,
      };
    },
    async fileTree(request) {
      const data = await context(request);
      return {
        worktreeId: request.worktreeId,
        entries: Object.keys(data.files).map((path) => ({
          path,
          kind: 'file' as const,
          ignored: false,
        })),
      };
    },
    async editFile(request) {
      await context(request);
      const fixture = store.review[request.worktreeId];
      if (!fixture) throw new ConnectionError('This worktree is unavailable.');
      const input = request.input;
      if (input.kind === 'write') fixture.files[input.path] = input.text;
      if (input.kind === 'create' && input.entryKind === 'file')
        fixture.files[input.path] = '';
      if (input.kind === 'move') {
        const value = fixture.files[input.path];
        if (value !== undefined) {
          fixture.files[input.destination] = value;
          delete fixture.files[input.path];
        }
      }
      if (input.kind === 'trash') delete fixture.files[input.path];
      const text = input.kind === 'write' ? input.text : '';
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(text),
      );
      return {
        path: input.kind === 'move' ? input.destination : input.path,
        contentFingerprint: [...new Uint8Array(digest)]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join(''),
      };
    },
    async asset(request) {
      await context(request);
      throw new ConnectionError('This asset is unavailable in the fixture.');
    },
    async text(request) {
      const data = await context(request);
      const text = data.files[request.path];
      if (text === undefined)
        throw new ConnectionError('This file is no longer available.');
      return {
        worktreeId: request.worktreeId,
        path: request.path,
        encoding: 'utf-8',
        byteLength: new TextEncoder().encode(text).length,
        text,
      };
    },
    async diff(request) {
      const data = await context(request);
      if (data.status.statusToken !== request.input.expectedStatusToken)
        throw new ConnectionError(
          'Changes moved since this list was loaded. Refresh the review.',
        );
      return {
        environmentId: data.status.environmentId,
        worktreeId: request.worktreeId,
        statusToken: data.status.statusToken,
        consistency: 'best-effort',
        change: request.input.change,
        oldMode: '100644',
        newMode: '100644',
        content: {
          kind: 'text',
          patch: mockPatch(request.input.change, data.files),
        },
      };
    },
    async commit(request) {
      const data = await context(request);
      const commit = data.history.commits.find(
        (item) => item.oid === request.oid,
      );
      if (!commit) throw new ConnectionError('This commit is unavailable.');
      const parentNumber = request.parent ?? 1;
      const baseOid = commit.parentOids[parentNumber - 1];
      if (
        (commit.parentOids.length === 0 && request.parent !== undefined) ||
        (commit.parentOids.length > 0 && baseOid == null)
      )
        throw new ConnectionError(`This commit has no parent ${parentNumber}.`);
      return {
        commitOid: commit.oid,
        parentOids: commit.parentOids,
        comparison: baseOid
          ? { kind: 'parent', parentNumber, baseOid }
          : { kind: 'empty-tree' },
        changes: [
          {
            oldPath: 'src/domain/review.ts',
            newPath: 'src/domain/review.ts',
            status: 'modified',
            oldMode: '100644',
            newMode: '100644',
            patch: {
              kind: 'text',
              text: '--- a/src/domain/review.ts\n+++ b/src/domain/review.ts\n@@ -1 +1,4 @@\n-export type Context = string;\n+export type ReviewScope = {\n+  projectId: string;\n+  worktreeId: string;\n+};\n',
            },
          },
        ],
      };
    },
    async directory(request) {
      const data = await context(request);
      const prefix = request.path ? `${request.path}/` : '';
      const entries = new Map<
        string,
        { name: string; kind: 'file' | 'directory' }
      >();
      for (const path of Object.keys(data.files).filter((path) =>
        path.startsWith(prefix),
      )) {
        const [name, ...rest] = path.slice(prefix.length).split('/');
        if (name)
          entries.set(name, { name, kind: rest.length ? 'directory' : 'file' });
      }
      return {
        worktreeId: request.worktreeId,
        path: request.path,
        entries: [...entries.values()].sort(
          (a, b) =>
            a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
        ),
      };
    },
    async changes(request) {
      const { status, layers } = await context(request);
      if (store.changesFailed)
        throw new ConnectionError(
          'This review surface could not be loaded. Refresh and try again.',
        );
      return { status, layers };
    },
    async history(request) {
      return (await context(request)).history;
    },
    async artifacts(request) {
      const { artifacts } = await context(request);
      if (store.artifactsFailed)
        throw new ConnectionError(
          'This review surface could not be loaded. Refresh and try again.',
        );
      return artifacts.map(({ content: _content, ...metadata }) => metadata);
    },
    async evidence(request) {
      const data = await context(request);
      if (store.evidenceFailed)
        throw new ConnectionError(
          'This review surface could not be loaded. Refresh and try again.',
        );
      return mockEvidence(request.worktreeId, data);
    },
    reviewed: {
      async list(request) {
        await context(request);
        if (store.reviewedFailed)
          throw new ConnectionError(
            'Reviewed files could not be loaded. Refresh and try again.',
          );
        return {
          worktreeId: request.worktreeId,
          marks: structuredClone(store.reviewed[request.worktreeId] ?? []),
        };
      },
      async set(request) {
        const data = await context(request);
        if (store.reviewedSetFailed)
          throw new ConnectionError(
            'The file could not be marked as reviewed. Try again.',
          );
        const current = mockEvidence(request.worktreeId, data).evidence.find(
          (entry) => entry.path === request.input.path,
        );
        if (!current || current.fingerprint !== request.input.fingerprint)
          throw new ConnectionError(
            'Reviewed mark is based on stale evidence.',
          );
        const marks = store.reviewed[request.worktreeId] ?? [];
        store.reviewed[request.worktreeId] = marks;
        const mark: ReviewedMark = {
          path: request.input.path,
          fingerprint: request.input.fingerprint,
          reviewedAt: new Date().toISOString(),
        };
        const index = marks.findIndex((item) => item.path === mark.path);
        if (index === -1) marks.push(mark);
        else marks[index] = mark;
        return {
          worktreeId: request.worktreeId,
          marks: structuredClone(marks),
        };
      },
      async remove(request) {
        await context(request);
        if (store.reviewedRemoveFailed)
          throw new ConnectionError(
            'The reviewed mark could not be removed. Try again.',
          );
        const marks = store.reviewed[request.worktreeId] ?? [];
        store.reviewed[request.worktreeId] = marks.filter(
          (item) => item.path !== request.path,
        );
        const nextMarks = store.reviewed[request.worktreeId] ?? [];
        return {
          worktreeId: request.worktreeId,
          marks: structuredClone(nextMarks),
        };
      },
    },
    async artifact(request) {
      const { artifacts } = await context(request);
      const artifact = artifacts.find((item) => item.id === request.artifactId);
      if (!artifact)
        throw new ConnectionError('This artifact is no longer available.');
      return artifact;
    },
  };
}

type ReviewFixture = ReturnType<typeof createMockStore>['review'][string];

function mockEvidence(
  worktreeId: string,
  data: ReviewFixture,
): EvidenceResponse {
  const byPath = new Map<
    string,
    EvidenceResponse['evidence'][number]['comparisons']
  >();
  for (const change of data.status.changes) {
    const path = changePath(change);
    const comparisons = byPath.get(path) ?? [];
    comparisons.push({ change, content: mockContent(change, data.files) });
    byPath.set(path, comparisons);
  }
  const evidence = [...byPath.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, comparisons]) => {
      const ordered = comparisons.toSorted((left, right) => {
        const scopeOrder = {
          staged: 0,
          unstaged: 1,
          untracked: 2,
          unmerged: 3,
        } as const;
        return (
          scopeOrder[left.change.scope] - scopeOrder[right.change.scope] ||
          changePath(left.change).localeCompare(changePath(right.change))
        );
      });
      const fingerprintable = ordered.every(
        (comparison) =>
          comparison.content.kind === 'file' ||
          (comparison.content.kind === 'diff' &&
            (comparison.content.content.kind === 'text' ||
              comparison.content.content.kind === 'metadata-only')),
      );
      return {
        path,
        fingerprint: fingerprintable ? mockFingerprint(path, ordered) : null,
        comparisons: ordered,
      };
    });
  return {
    environmentId: data.status.environmentId,
    worktreeId,
    statusToken: data.status.statusToken,
    consistency: 'best-effort',
    evidence,
  };
}

function mockContent(change: Change, files: Record<string, string>) {
  if (change.scope === 'unmerged')
    return { kind: 'omitted' as const, reason: 'conflict' as const };
  if (change.scope === 'untracked') {
    const text = files[change.path];
    return text === undefined
      ? { kind: 'omitted' as const, reason: 'unreadable' as const }
      : {
          kind: 'file' as const,
          encoding: 'utf-8' as const,
          byteLength: new TextEncoder().encode(text).byteLength,
          text,
        };
  }
  if (!change.supported)
    return {
      kind: 'omitted' as const,
      reason: 'unsupported-git-entry' as const,
    };
  return {
    kind: 'diff' as const,
    content: { kind: 'text' as const, patch: mockPatch(change, files) },
  };
}

function mockFingerprint(
  path: string,
  comparisons: ReadonlyArray<
    EvidenceResponse['evidence'][number]['comparisons'][number]
  >,
) {
  const input = JSON.stringify({ path, comparisons });
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const seed = (hash >>> 0).toString(16).padStart(8, '0');
  return seed.repeat(8);
}

function changePath(change: Change) {
  return 'path' in change
    ? change.path
    : (change.newPath ?? change.oldPath ?? '');
}

function mockPatch(
  change: import('../../domain/review').DiffRequest['change'],
  files: Record<string, string>,
) {
  const path = change.newPath ?? change.oldPath ?? '';
  if (!change.newPath)
    return `--- a/${path}\n+++ /dev/null\n@@ -1 +0,0 @@\n-export const legacyPanel = true;\n`;
  const contents = files[path] ?? '';
  const lines = contents.trimEnd().split('\n');
  const oldRange = change.oldPath ? '-1' : '-0,0';
  return `--- ${change.oldPath ? `a/${change.oldPath}` : '/dev/null'}\n+++ b/${path}\n@@ ${oldRange} +1,${lines.length} @@\n${change.oldPath ? '-// Previous implementation\n' : ''}${lines.map((line) => `+${line}`).join('\n')}\n`;
}
