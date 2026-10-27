import { type CommentThread, threadState } from './comments.ts';
import { type ReviewProof, proofStatus } from './proof.ts';
import {
  notExplainedLabel,
  type ReviewResponse,
  type ReviewStatus,
} from './review.ts';

export type ReadinessKey =
  | 'files'
  | 'stale'
  | 'unexplained'
  | 'comments'
  | 'replies'
  | 'checks';
export type ReadinessTone = 'ok' | 'attention' | 'failing';
export type ReadinessItem = {
  key: ReadinessKey;
  label: string;
  value: string;
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
  const total = status.failing + status.passing;
  if (status.failing > 0)
    return {
      key: 'checks',
      value: `${status.failing} of ${total} failing`,
      label: `${status.failing} of ${counted(total, 'check', 'checks')} failing`,
      tone: 'failing',
    };
  if (total === 0)
    return {
      key: 'checks',
      label: 'No checks attached',
      value: 'None attached',
      tone: 'attention',
    };
  if (proof?.current === false)
    return {
      key: 'checks',
      value: 'Outdated',
      label: 'Checks ran before the latest changes',
      tone: 'attention',
    };
  return {
    key: 'checks',
    label: `${counted(total, 'check', 'checks')} passed`,
    value: `${total} passed`,
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
      value: 'No review',
      tone: 'attention',
    };
  const label = notExplainedLabel(review.notExplained);
  return label === null
    ? {
        key: 'unexplained',
        label: 'Every change explained',
        value: 'All explained',
        tone: 'ok',
      }
    : {
        key: 'unexplained',
        label: `${label} not explained`,
        value: label,
        tone: 'attention',
      };
}

function commentItems(onAgent: number, onYou: number): ReadinessItem[] {
  if (onAgent === 0 && onYou === 0)
    return [
      {
        key: 'comments',
        label: 'No open comments',
        value: 'None open',
        tone: 'ok',
      },
    ];
  const items: ReadinessItem[] = [];
  if (onAgent > 0)
    items.push({
      key: 'comments',
      label: `${counted(onAgent, 'comment', 'comments')} waiting on the agent`,
      value: `${onAgent} awaiting agent`,
      tone: 'attention',
    });
  if (onYou > 0)
    items.push({
      key: 'replies',
      label: `${counted(onYou, 'comment', 'comments')} waiting on you`,
      value: `${onYou} awaiting you`,
      tone: 'attention',
    });
  return items;
}

export function readinessItems(input: ReadinessInput): ReadinessItem[] {
  const total = input.files.length;
  const reviewed = input.files.filter(
    (file) => file.reviewStatus === 'reviewed',
  ).length;
  const stale = input.files.filter(
    (file) => file.reviewStatus === 'stale',
  ).length;
  const waitingOnAgent = input.threads.filter(
    (thread) => threadState(thread) === 'awaiting-agent',
  ).length;
  const waitingOnYou = input.threads.filter(
    (thread) => threadState(thread) === 'agent-replied',
  ).length;
  const unexplained = input.explains ? unexplainedItem(input.review) : null;
  return [
    total === 0
      ? {
          key: 'files',
          label: 'No changed files',
          value: 'None changed',
          tone: 'ok',
        }
      : {
          key: 'files',
          label: `${reviewed} of ${counted(total, 'file', 'files')} reviewed`,
          value: `${reviewed} of ${total} reviewed`,
          tone: reviewed === total ? 'ok' : 'attention',
        },
    stale === 0
      ? {
          key: 'stale',
          label: 'No marks went stale',
          value: 'None stale',
          tone: 'ok',
        }
      : {
          key: 'stale',
          label: `${counted(stale, 'mark', 'marks')} changed since reviewed`,
          value: `${stale} changed`,
          tone: 'attention',
        },
    ...(unexplained === null ? [] : [unexplained]),
    ...commentItems(waitingOnAgent, waitingOnYou),
    checksItem(input.review?.proof),
  ];
}

export function readinessSummary(
  items: readonly Pick<ReadinessItem, 'tone'>[],
): string {
  const open = items.filter((item) => item.tone !== 'ok').length;
  return open === 0
    ? 'Nothing left to check'
    : `${counted(open, 'thing', 'things')} to check`;
}
