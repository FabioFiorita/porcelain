import {
  listAccessResponseSchema,
  readHealthResponseSchema,
} from '@porcelain/contracts/access';
import {
  listCommitsResponseSchema,
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
  listGitBranchesResponseSchema,
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
import { hostCommands } from './commands';

type Schema<T> = { parse(value: unknown): T };

async function read<T>(
  schema: Schema<T>,
  path: string,
  target: 'network' | 'owner' = 'network',
): Promise<T> {
  const answer = await hostCommands.porcelainRead({ target, path });
  if (answer.status !== 200)
    throw new Error(`The server answered ${path} with ${answer.status}.`);
  return schema.parse(answer.body);
}

function query(values: Record<string, string>) {
  return `?${new URLSearchParams(values).toString()}`;
}

async function sampleProject() {
  const project = (await read(readInventoryResponseSchema, '/api/inventory'))
    .projects[0];
  if (!project) throw new Error('The isolated server has no project.');
  return project;
}

async function worktreePath(suffix: string) {
  const worktree = (await sampleProject()).worktrees[0];
  if (!worktree) throw new Error('The isolated server has no worktree.');
  return `/api/worktrees/${encodeURIComponent(worktree.id)}${suffix}`;
}

export const server = {
  health: () => read(readHealthResponseSchema, '/api/health'),
  inventory: () => read(readInventoryResponseSchema, '/api/inventory'),
  project: sampleProject,
  devices: async () =>
    (await read(listAccessResponseSchema, '/access', 'owner')).devices,
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
  reviewedFiles: async () =>
    read(listReviewedFilesResponseSchema, await worktreePath('/reviewed')),
  reviewedLayers: async () =>
    read(
      listReviewedLayersResponseSchema,
      await worktreePath('/reviewed-layers'),
    ),
  publishedReview: async () =>
    read(readPublishedReviewResponseSchema, await worktreePath('/review')),
  commentThreads: async () =>
    read(listCommentThreadsResponseSchema, await worktreePath('/comments')),
  branches: async () =>
    read(listGitBranchesResponseSchema, await worktreePath('/git/branches')),
  commitModels: () =>
    read(listCommitModelsResponseSchema, '/api/git/commit-models'),
  receipt: async (requestId: string) =>
    read(
      readGitActionReceiptResponseSchema,
      await worktreePath(`/git/receipts/${encodeURIComponent(requestId)}`),
    ),
};
