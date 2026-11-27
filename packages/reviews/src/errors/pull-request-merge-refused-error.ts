import { Schema } from 'effect';
import { pullRequestMergeRefusalSchema } from '../models/pull-request.ts';

const refusals: Record<typeof pullRequestMergeRefusalSchema.Type, string> = {
  'not-mergeable': 'GitHub refused the merge.',
  'head-changed':
    'The pull request changed since it was read. Read it again before merging.',
  'gh-not-installed': 'The GitHub CLI (gh) is not installed on this computer.',
  'no-accounts':
    'No GitHub account is signed in. Run gh auth login on this computer.',
  'no-access': 'The chosen GitHub account cannot merge in this repository.',
  'not-github': 'This repository has no GitHub remote.',
  'rate-limited': 'GitHub rate limit reached. Try again later.',
  offline:
    'GitHub could not be reached. Check the pull request before trying again.',
  'invalid-response':
    'GitHub’s answer was unreadable. Check the pull request before trying again.',
  'pull-request-not-found': 'GitHub could not find this pull request.',
};

export class PullRequestMergeRefusedError extends Schema.TaggedError<PullRequestMergeRefusedError>()(
  'PullRequestMergeRefusedError',
  {
    reason: pullRequestMergeRefusalSchema,
    detail: Schema.optional(Schema.String),
  },
) {
  override get message() {
    if (this.reason === 'not-mergeable' && this.detail)
      return `GitHub refused the merge: ${this.detail.replace(/\.$/, '')}.`;
    return refusals[this.reason];
  }
}
