import {
  listAccessResponseSchema,
  readHealthResponseSchema,
  readRemoteAccessResponseSchema,
  readServiceUpdateResponseSchema,
} from '@porcelain/contracts/access';
import {
  listCommitsResponseSchema,
  readBranchChangesResponseSchema,
  readChangesResponseSchema,
  readCommitFilesResponseSchema,
  readGitStatusResponseSchema,
} from '@porcelain/contracts/changes';
import {
  listDirectoryResponseSchema,
  listWorktreePathsResponseSchema,
  readTextFileResponseSchema,
} from '@porcelain/contracts/files';
import {
  listCommitModelsResponseSchema,
  readGitActionReceiptResponseSchema,
} from '@porcelain/contracts/git-actions';
import {
  listFilePreferencesResponseSchema,
  readInventoryResponseSchema,
} from '@porcelain/contracts/projects';
import {
  listCommentThreadsResponseSchema,
  listReviewedFilesResponseSchema,
  listReviewedLayersResponseSchema,
  readPublishedReviewResponseSchema,
} from '@porcelain/contracts/reviews';
import type { Hit } from './session.ts';
import * as Schema from 'effect/Schema';

export type ServerAnswer = { status: number; body: unknown };

function query(values: Record<string, string>) {
  return `?${new URLSearchParams(values).toString()}`;
}

export type ServerTransport = {
  read: (request: {
    target: 'network' | 'owner';
    path: string;
  }) => Promise<ServerAnswer>;
  hits: () => Promise<Hit[]>;
};

export function serverReaders(transport: ServerTransport) {
  const read = async <T>(
    schema: Schema.Decoder<T>,
    path: string,
    target: 'network' | 'owner' = 'network',
  ): Promise<T> => {
    const answer = await transport.read({ target, path });
    if (answer.status !== 200)
      throw new Error(`The server answered ${path} with ${answer.status}.`);
    return Schema.decodeUnknownSync(schema)(answer.body);
  };

  const sampleProject = async () => {
    const project = (await read(readInventoryResponseSchema, '/api/inventory'))
      .projects[0];
    if (!project) throw new Error('The isolated server has no project.');
    return project;
  };
  const worktreePath = async (suffix: string) => {
    const worktree = (await sampleProject()).worktrees[0];
    if (!worktree) throw new Error('The isolated server has no worktree.');
    return `/api/worktrees/${encodeURIComponent(worktree.id)}${suffix}`;
  };
  const hits = transport.hits;
  return {
    liveTicketHits: async () =>
      (await hits()).filter(
        (hit) =>
          !hit.kit &&
          hit.method === 'POST' &&
          hit.route === '/api/live/tickets',
      ),
    changeDiffHits: async () =>
      (await hits()).filter(
        (hit) =>
          !hit.kit &&
          hit.method === 'POST' &&
          hit.route === '/api/worktrees/:worktreeId/changes/diffs',
      ),
    changeListHits: async () =>
      (await hits()).filter(
        (hit) =>
          !hit.kit &&
          hit.method === 'GET' &&
          hit.route === '/api/worktrees/:worktreeId/changes',
      ),
    fileWriteCount: async () =>
      (await hits()).filter(
        (hit) =>
          !hit.kit &&
          hit.method === 'POST' &&
          hit.route === '/api/worktrees/:worktreeId/files',
      ).length,
    health: () => read(readHealthResponseSchema, '/api/health'),
    inventory: () => read(readInventoryResponseSchema, '/api/inventory'),
    project: sampleProject,
    devices: async () =>
      (await read(listAccessResponseSchema, '/access', 'owner')).devices,
    pendingLinks: async () =>
      (await read(listAccessResponseSchema, '/access', 'owner')).grants,
    remoteAccess: () =>
      read(readRemoteAccessResponseSchema, '/api/remote-access'),
    serviceUpdate: () =>
      read(readServiceUpdateResponseSchema, '/api/service/update'),
    filePreferences: async () =>
      read(
        listFilePreferencesResponseSchema,
        `/api/projects/${encodeURIComponent((await sampleProject()).id)}/file-preferences`,
      ),
    changes: async () =>
      read(readChangesResponseSchema, await worktreePath('/changes')),
    gitStatus: async () =>
      read(readGitStatusResponseSchema, await worktreePath('/git/status')),
    commits: async () =>
      read(listCommitsResponseSchema, await worktreePath('/commits')),
    commitFiles: async (oid: string) =>
      read(
        readCommitFilesResponseSchema,
        await worktreePath(`/commits/${encodeURIComponent(oid)}/files`),
      ),
    text: async (path: string) =>
      read(
        readTextFileResponseSchema,
        await worktreePath(`/text${query({ path })}`),
      ),
    directory: async (path: string) =>
      read(
        listDirectoryResponseSchema,
        await worktreePath(`/directory${query({ path })}`),
      ),
    paths: async () =>
      read(listWorktreePathsResponseSchema, await worktreePath('/paths')),
    reviewedFiles: async (branch?: string) =>
      read(
        listReviewedFilesResponseSchema,
        await worktreePath(
          `/reviewed${branch ? query({ scope: 'branch', branch }) : ''}`,
        ),
      ),
    branchChanges: async (base?: string) =>
      read(
        readBranchChangesResponseSchema,
        await worktreePath(`/branch-changes${base ? query({ base }) : ''}`),
      ),
    reviewedLayers: async () =>
      read(
        listReviewedLayersResponseSchema,
        await worktreePath('/reviewed-layers'),
      ),
    publishedReview: async () =>
      read(readPublishedReviewResponseSchema, await worktreePath('/review')),
    commentThreads: async () =>
      read(listCommentThreadsResponseSchema, await worktreePath('/comments')),
    commitModels: () =>
      read(listCommitModelsResponseSchema, '/api/git/commit-models'),
    receipt: async (requestId: string) =>
      read(
        readGitActionReceiptResponseSchema,
        await worktreePath(`/git/receipts/${encodeURIComponent(requestId)}`),
      ),
  };
}

export type ServerReaders = ReturnType<typeof serverReaders>;
