import {
  archivePullRequestRequestSchema,
  archivePullRequestResponseSchema,
} from '@porcelain/projects/models';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import { porcelainApi } from '../shared/http-api.ts';
import { PairedRequest } from '../shared/http-caller.ts';
import { httpFailure } from '../shared/http-failure.ts';
import {
  ProjectNotFoundError,
  BranchArchiveRefusedError,
} from '@porcelain/projects/errors';
import {
  projectParamsSchema,
  projectPullRequestParamsSchema,
  listPullRequestsResponseSchema,
  githubAccountResultSchema,
  setGitHubAccountRequestSchema,
  readPullRequestResponseSchema,
  readPullChecksResponseSchema,
} from './pull-requests.ts';

export class PullRequestsApi extends porcelainApi.add(
  HttpApiGroup.make('pullRequests')
    .add(
      HttpApiEndpoint.get(
        'listProjectPullRequests',
        '/api/projects/:projectId/pull-requests',
        {
          disableCodecs: true,
          params: projectParamsSchema,
          success: listPullRequestsResponseSchema,
          error: [httpFailure(ProjectNotFoundError, 'NotFound')],
        },
      ),
      HttpApiEndpoint.get(
        'readProjectGitHubAccount',
        '/api/projects/:projectId/github-account',
        {
          disableCodecs: true,
          params: projectParamsSchema,
          success: githubAccountResultSchema,
          error: [httpFailure(ProjectNotFoundError, 'NotFound')],
        },
      ),
      HttpApiEndpoint.put(
        'setProjectGitHubAccount',
        '/api/projects/:projectId/github-account',
        {
          disableCodecs: true,
          params: projectParamsSchema,
          payload: setGitHubAccountRequestSchema,
          success: githubAccountResultSchema,
          error: [httpFailure(ProjectNotFoundError, 'NotFound')],
        },
      ),
      HttpApiEndpoint.get(
        'readProjectPullRequest',
        '/api/projects/:projectId/pull-requests/:number',
        {
          disableCodecs: true,
          params: projectPullRequestParamsSchema,
          success: readPullRequestResponseSchema,
          error: [httpFailure(ProjectNotFoundError, 'NotFound')],
        },
      ),
      HttpApiEndpoint.get(
        'readProjectPullChecks',
        '/api/projects/:projectId/pull-requests/:number/checks',
        {
          disableCodecs: true,
          params: projectPullRequestParamsSchema,
          success: readPullChecksResponseSchema,
          error: [httpFailure(ProjectNotFoundError, 'NotFound')],
        },
      ),
      HttpApiEndpoint.post(
        'archivePullRequest',
        '/api/projects/:projectId/pull-requests/:number/archive',
        {
          disableCodecs: true,
          params: projectPullRequestParamsSchema,
          payload: archivePullRequestRequestSchema,
          success: archivePullRequestResponseSchema,
          error: [
            httpFailure(ProjectNotFoundError, 'NotFound'),
            httpFailure(BranchArchiveRefusedError, 'Conflict', {
              message: { fromError: true },
            }),
          ],
        },
      ),
    )
    .middleware(PairedRequest),
) {}
