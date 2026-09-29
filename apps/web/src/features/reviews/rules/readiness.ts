import { type CommentThread, threadState } from './comments';
import { type ReviewProof, proofStatus } from './proof';
import {
  notExplainedLabel,
  type ReviewResponse,
  type ReviewStatus,
} from './review';

export type ReadinessKey =
  | 'files'
  | 'stale'
  | 'unexplained'
  | 'comments'
  | 'checks';
export type ReadinessTone = 'ok' | 'attention' | 'failing';
export type ReadinessItem = {
  key: ReadinessKey;
  label: string;
  tone: ReadinessTone;
};

type ReadinessInput = {
  files: readonly { reviewStatus: ReviewStatus }[];
  review: Pick<ReviewResponse, 'notExplained' | 'proof'> | null;
  explains: boolean;
  threads: readonly CommentThread[];
};

function counted(total: number, one: string, many: string) {
  return `${total} ${total === 1 ? one : many}`;
}

function checksItem(proof: ReviewProof | undefined): ReadinessItem {
  const status = proofStatus(proof);
  const total = status.failing + status.skipped + status.passing;
  if (status.failing > 0)
    return {
      key: 'checks',
      label: `${status.failing} of ${counted(total, 'check', 'checks')} failing`,
      tone: 'failing',
    };
  if (total === 0)
    return { key: 'checks', label: 'No checks attached', tone: 'attention' };
  if (status.skipped > 0)
    return {
      key: 'checks',
      label: `${counted(status.skipped, 'check', 'checks')} skipped`,
      tone: 'attention',
    };
  return {
    key: 'checks',
    label: `${counted(total, 'check', 'checks')} passed`,
    tone: 'ok',
  };
}

function unexplainedItem(
  review: ReadinessInput['review'],
): ReadinessItem | null {
  if (review === null)
    return {
      key: 'unexplained',
      label: 'No review published',
      tone: 'attention',
    };
  const label = notExplainedLabel(review.notExplained);
  return label === null
    ? { key: 'unexplained', label: 'Every change explained', tone: 'ok' }
    : {
        key: 'unexplained',
        label: `${label} not explained`,
        tone: 'attention',
      };
}

export function readinessItems(input: ReadinessInput): ReadinessItem[] {
  const total = input.files.length;
  const reviewed = input.files.filter(
    (file) => file.reviewStatus === 'reviewed',
  ).length;
  const stale = input.files.filter(
    (file) => file.reviewStatus === 'stale',
  ).length;
  const waiting = input.threads.filter(
    (thread) => threadState(thread) === 'awaiting-agent',
  ).length;
  const unexplained = input.explains ? unexplainedItem(input.review) : null;
  return [
    total === 0
      ? { key: 'files', label: 'No changed files', tone: 'ok' }
      : {
          key: 'files',
          label: `${reviewed} of ${counted(total, 'file', 'files')} reviewed`,
          tone: reviewed === total ? 'ok' : 'attention',
        },
    stale === 0
      ? { key: 'stale', label: 'No marks went stale', tone: 'ok' }
      : {
          key: 'stale',
          label: `${counted(stale, 'mark', 'marks')} changed since reviewed`,
          tone: 'attention',
        },
    ...(unexplained === null ? [] : [unexplained]),
    waiting === 0
      ? {
          key: 'comments',
          label: 'No comments waiting on the agent',
          tone: 'ok',
        }
      : {
          key: 'comments',
          label: `${counted(waiting, 'comment', 'comments')} waiting on the agent`,
          tone: 'attention',
        },
    checksItem(input.review?.proof),
  ];
}

export function readinessSummary(items: readonly ReadinessItem[]): string {
  const open = items.filter((item) => item.tone !== 'ok').length;
  return open === 0
    ? 'Ready to merge'
    : `${counted(open, 'thing', 'things')} to check`;
}
