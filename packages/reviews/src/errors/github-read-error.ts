import { Schema } from 'effect';
import { githubUnavailableReasonSchema } from '../models/pull-request.ts';
export class GitHubReadError extends Schema.TaggedError<GitHubReadError>()(
  'GitHubReadError',
  { reason: githubUnavailableReasonSchema },
) {}
