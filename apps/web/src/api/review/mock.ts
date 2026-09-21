import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { RequestError } from '@porcelain/client/errors/request-error';
import { setReviewedLayerRequestSchema } from '@porcelain/contracts/reviewed-files';
import type {
  Change,
  ChangeList,
  ChangeSelection,
  FileChange,
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
    reviewedLayers: {
      async list(request) {
        request.signal.throwIfAborted();
        return {
          worktreeId: request.worktreeId,
          marks: structuredClone(
            store.reviewedLayers[request.worktreeId] ?? [],
          ),
        };
      },
      async set(request) {
        request.signal.throwIfAborted();
        const input = setReviewedLayerRequestSchema.parse(request.input);
        const marks = (store.reviewedLayers[request.worktreeId] ?? []).filter(
          (mark) => mark.layerId !== input.layerId,
        );
        marks.push({
          layerId: input.layerId,
          fingerprint: input.fingerprint,
          reviewedAt: new Date().toISOString(),
          stale: false,
        });
        store.reviewedLayers[request.worktreeId] = marks;
        return {
          worktreeId: request.worktreeId,
          marks: structuredClone(marks),
        };
      },
      async remove(request) {
        request.signal.throwIfAborted();
        const marks = (store.reviewedLayers[request.worktreeId] ?? []).filter(
          (mark) => mark.layerId !== request.layerId,
        );
        store.reviewedLayers[request.worktreeId] = marks;
        return {
          worktreeId: request.worktreeId,
          marks: structuredClone(marks),
        };
      },
    },
    async review(request) {
      await context(request);
      if (store.publishedReviewFailed)
        throw new ConnectionError('Published review could not be loaded.');
      return structuredClone(
        store.publishedReviews[request.worktreeId] ?? null,
      );
    },
    async previewAssets(request) {
      await context(request);
      return {
        assets: request.paths.map((path) => ({
          kind: 'unavailable' as const,
          path,
        })),
      };
    },
    async worktreePaths(request) {
      const data = await context(request);
      return {
        worktreeId: request.worktreeId,
        paths: Object.keys(data.files).sort(),
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
    async status(request) {
      const data = await context(request);
      return {
        environmentId: data.git.environmentId,
        worktreeId: request.worktreeId,
        statusToken: data.git.statusToken,
        consistency: 'best-effort',
        headOid: data.git.headOid,
        inProgress: null,
        mergeHeadOid: null,
        headCommit: data.git.headOid ? { subject: 'Previous commit' } : null,
        ...(data.git.branch
          ? {
              branch: {
                ...data.git.branch,
                remoteName: 'origin',
                sourceRef: `refs/heads/${data.git.branch.name}`,
                stashes: [],
              },
            }
          : {}),
        changes: data.git.comparisons,
      };
    },
    async diffs(request) {
      const data = await context(request);
      const list = mockChangeList(request.worktreeId, data);
      // The same refusal the server makes: the hunks must be about the state
      // the caller's list described, not merely the same status output.
      const moved =
        data.git.statusToken !== request.input.expectedStatusToken ||
        request.input.expectedFiles.some(
          (file) =>
            list.changes.find((entry) => entry.path === file.path)
              ?.fingerprint !== file.fingerprint,
        );
      if (moved)
        throw new RequestError(
          409,
          'WORKTREE_CHANGED',
          'Refresh status and retry inspection',
        );
      if (store.diffsFailed)
        throw new ConnectionError('These changes could not be read.');
      return {
        environmentId: data.git.environmentId,
        worktreeId: request.worktreeId,
        statusToken: data.git.statusToken,
        diffs: request.input.selections.map((selection) => ({
          selection,
          content: {
            kind: 'text' as const,
            patch: mockPatch(selection, data.files),
          },
        })),
      };
    },
    async lines(request) {
      const data = await context(request);
      const text = data.files[request.path];
      if (text === undefined)
        throw new ConnectionError('This file is no longer available.');
      const lines = text.split('\n');
      return {
        environmentId: data.git.environmentId,
        worktreeId: request.worktreeId,
        at: request.at,
        path: request.path,
        from: request.from,
        to: Math.min(request.to, lines.length),
        lines: lines.slice(request.from - 1, request.to),
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
        commit,
        comparison: baseOid
          ? { kind: 'parent', parentNumber, baseOid }
          : { kind: 'empty-tree' },
        files: [
          {
            oldPath: 'src/domain/review.ts',
            newPath: 'src/domain/review.ts',
            status: 'modified',
            oldMode: '100644',
            newMode: '100644',
          },
        ],
      };
    },
    async commitDiffs(request) {
      await context(request);
      return {
        commitOid: request.oid,
        diffs: request.paths.map((paths) => ({
          paths,
          content: {
            kind: 'text',
            patch:
              '--- a/src/domain/review.ts\n+++ b/src/domain/review.ts\n@@ -1 +1,4 @@\n-export type Context = string;\n+export type ReviewScope = {\n+  projectId: string;\n+  worktreeId: string;\n+};\n',
          },
        })),
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
      const data = await context(request);
      if (store.changesFailed)
        throw new ConnectionError(
          'This review surface could not be loaded. Refresh and try again.',
        );
      return {
        changes: mockChangeList(request.worktreeId, data),
      };
    },
    async history(request) {
      return (await context(request)).history;
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
        const current = mockChangeList(request.worktreeId, data).changes.find(
          (entry) => entry.path === request.input.path,
        );
        if (!current || current.fingerprint !== request.input.fingerprint)
          throw new ConnectionError(
            'The reviewed mark is based on a version of the file that has changed.',
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
  };
}

type ReviewFixture = ReturnType<typeof createMockStore>['review'][string];

/**
 * What changed, grouped by path, with a fingerprint over the content the
 * fixture would serve for it. Deriving it from the files means editing one in
 * the mock invalidates its mark, exactly as a real edit does.
 */
function mockChangeList(worktreeId: string, data: ReviewFixture): ChangeList {
  const byPath = new Map<string, Change[]>();
  for (const change of data.git.comparisons) {
    const path = changePath(change);
    byPath.set(path, [...(byPath.get(path) ?? []), change]);
  }
  const scopeOrder = {
    staged: 0,
    unstaged: 1,
    untracked: 2,
    unmerged: 3,
  } as const;
  const changes: FileChange[] = [...byPath.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, comparisons]) => {
      const ordered = comparisons.toSorted(
        (left, right) =>
          scopeOrder[left.scope] - scopeOrder[right.scope] ||
          changePath(left).localeCompare(changePath(right)),
      );
      const markable = ordered.every(
        (change) =>
          change.scope !== 'unmerged' &&
          (change.scope !== 'untracked' ||
            data.files[change.path] !== undefined),
      );
      return {
        path,
        fingerprint: markable
          ? mockFingerprint(path, ordered, data.files)
          : null,
        comparisons: ordered,
      };
    });
  return {
    environmentId: data.git.environmentId,
    worktreeId,
    statusToken: data.git.statusToken,
    headOid: data.git.headOid,
    inProgress: null,
    mergeHeadOid: null,
    branch: data.git.branch,
    changes,
  };
}

function mockFingerprint(
  path: string,
  comparisons: readonly Change[],
  files: Record<string, string>,
) {
  const input = JSON.stringify({
    path,
    comparisons,
    text: files[path] ?? null,
  });
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

function mockPatch(change: ChangeSelection, files: Record<string, string>) {
  const path = change.newPath ?? change.oldPath ?? '';
  if (!change.newPath)
    return `--- a/${path}\n+++ /dev/null\n@@ -1 +0,0 @@\n-export const legacyPanel = true;\n`;
  const contents = files[path] ?? '';
  const lines = contents.trimEnd().split('\n');
  const oldRange = change.oldPath ? '-1' : '-0,0';
  return `--- ${change.oldPath ? `a/${change.oldPath}` : '/dev/null'}\n+++ b/${path}\n@@ ${oldRange} +1,${lines.length} @@\n${change.oldPath ? '-// Previous implementation\n' : ''}${lines.map((line) => `+${line}`).join('\n')}\n`;
}
