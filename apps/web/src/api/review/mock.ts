import { ConnectionError } from '@porcelain/client/errors/connection-error';
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
      return {
        commitOid: commit.oid,
        parentOids: commit.parentOids,
        comparison: commit.parentOids[0]
          ? { kind: 'parent', parentNumber: 1, baseOid: commit.parentOids[0] }
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
    async artifact(request) {
      const { artifacts } = await context(request);
      const artifact = artifacts.find((item) => item.id === request.artifactId);
      if (!artifact)
        throw new ConnectionError('This artifact is no longer available.');
      return artifact;
    },
  };
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
