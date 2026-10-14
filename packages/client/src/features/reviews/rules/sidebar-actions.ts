import type { ReviewStatus } from './review.ts';

export type ReviewSidebarAction = {
  id:
    | 'open'
    | 'review'
    | 'comment'
    | 'open-to-side'
    | 'open-file'
    | 'timeline'
    | 'copy-relative'
    | 'discard'
    | 'expand-all'
    | 'collapse-all'
    | 'reply'
    | 'resolution'
    | 'reveal';
  label: string;
  disabled?: boolean;
  destructive?: boolean;
};

type Target =
  | {
      kind: 'file';
      status: ReviewStatus | undefined;
      canReview: boolean;
      sideLabel: string;
      canDiscard: boolean;
    }
  | {
      kind: 'decision';
      reviewed: boolean;
      stale: boolean;
      settled: boolean;
      pending: boolean;
    }
  | { kind: 'section' }
  | { kind: 'group' }
  | { kind: 'thread'; resolved: boolean; pending: boolean; canReveal: boolean };

function reviewLabel(reviewed: boolean, stale: boolean) {
  return reviewed
    ? 'Unmark as reviewed'
    : stale
      ? 'Mark as reviewed again'
      : 'Mark as reviewed';
}

export function reviewSidebarActions(
  target: Target,
): readonly ReviewSidebarAction[] {
  switch (target.kind) {
    case 'file':
      return [
        {
          id: 'review',
          label: reviewLabel(
            target.status === 'reviewed',
            target.status === 'stale',
          ),
          disabled: !target.canReview,
        },
        { id: 'comment', label: 'Comment' },
        { id: 'open', label: 'Open diff' },
        { id: 'open-to-side', label: target.sideLabel },
        { id: 'open-file', label: 'Open file' },
        { id: 'timeline', label: 'Show timeline' },
        { id: 'copy-relative', label: 'Copy relative path' },
        ...(target.canDiscard
          ? [{ id: 'discard' as const, label: 'Discard', destructive: true }]
          : []),
      ];
    case 'decision':
      return [
        { id: 'open', label: 'Open' },
        {
          id: 'review',
          label: reviewLabel(target.reviewed, target.stale),
          disabled: !target.settled || target.pending,
        },
      ];
    case 'section':
      return [{ id: 'open', label: 'Open' }];
    case 'group':
      return [
        { id: 'expand-all', label: 'Expand all' },
        { id: 'collapse-all', label: 'Collapse all' },
      ];
    case 'thread':
      return [
        ...(target.canReveal
          ? [{ id: 'reveal' as const, label: 'Show in the code' }]
          : []),
        ...(!target.resolved
          ? [{ id: 'reply' as const, label: 'Reply', disabled: target.pending }]
          : []),
        {
          id: 'resolution',
          label: target.resolved ? 'Reopen' : 'Resolve',
          disabled: target.pending,
        },
      ];
    default:
      return target satisfies never;
  }
}
