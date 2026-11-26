import { Schema } from 'effect';
import { pullRequestActionRefusalSchema } from '../models/pull-request.ts';

const refusals: Record<typeof pullRequestActionRefusalSchema.Type, string> = {
  refused: 'GitHub refused the request.',
  'head-changed':
    'The pull request has a newer head. Read it again before re-running.',
  'not-rerunnable': 'This check is no longer on the pull request’s head.',
  'gh-not-installed': 'The GitHub CLI (gh) is not installed on this computer.',
  'no-accounts':
    'No GitHub account is signed in. Run gh auth login on this computer.',
  'no-access': 'The chosen GitHub account cannot do this in this repository.',
  'not-github': 'This repository has no GitHub remote.',
  'rate-limited': 'GitHub rate limit reached. Try again later.',
  offline: 'GitHub could not be reached. Try again.',
  'invalid-response': 'GitHub’s answer was unreadable. Try again.',
  'pull-request-not-found': 'GitHub could not find this pull request.',
};

export class PullRequestActionRefusedError extends Schema.TaggedError<PullRequestActionRefusedError>()(
  'PullRequestActionRefusedError',
  {
    reason: pullRequestActionRefusalSchema,
    detail: Schema.optional(Schema.String),
  },
) {
  override get message() {
    if (this.detail)
      return `GitHub refused: ${this.detail.replace(/\.$/, '')}.`;
    return refusals[this.reason];
  }
}
