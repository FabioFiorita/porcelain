import { Schema } from 'effect';

export class GitHubPullRequestNotFoundError extends Schema.TaggedError<GitHubPullRequestNotFoundError>()(
  'GitHubPullRequestNotFoundError',
  {},
) {}
