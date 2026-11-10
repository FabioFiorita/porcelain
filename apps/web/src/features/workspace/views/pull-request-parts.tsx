import {
  CheckIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  pullRequestState,
  pullRequestStateLabel,
  type PullChecksTone,
  type PullRequestState,
} from '@porcelain/client/reviews/rules';
import { Badge } from '@/components/ui/badge';

import { cn } from '@/shared/lib/utils';

type PullState = { state: 'open' | 'closed' | 'merged'; draft: boolean };

const stateIcons: Record<PullRequestState, LucideIcon> = {
  open: GitPullRequestIcon,
  draft: GitPullRequestDraftIcon,
  merged: GitMergeIcon,
  closed: GitPullRequestClosedIcon,
};

export function PullStatePill({ pull }: { pull: PullState }) {
  const state = pullRequestState(pull);
  const Icon = stateIcons[state];
  return (
    <Badge variant={state}>
      <Icon aria-hidden="true" />
      {pullRequestStateLabel(pull)}
    </Badge>
  );
}

export function UnavailablePill() {
  return (
    <Badge variant="outline">
      <TriangleAlertIcon aria-hidden="true" />
      GitHub unavailable
    </Badge>
  );
}

const checkIcons: Record<Exclude<PullChecksTone, 'none'>, ReactNode> = {
  passed: (
    <CheckIcon
      aria-hidden="true"
      strokeWidth={2.5}
      className="size-3 shrink-0 text-add-fg"
    />
  ),
  running: <LoaderCircleIcon aria-hidden="true" className="size-3 shrink-0" />,
  failed: (
    <XIcon
      aria-hidden="true"
      strokeWidth={2.5}
      className="size-3 shrink-0 text-del-fg"
    />
  ),
};

export function ChecksStatus({
  tone,
  label,
  className,
}: {
  tone: PullChecksTone;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {tone !== 'none' && checkIcons[tone]}
      {label}
    </span>
  );
}

export function Dot() {
  return (
    <span aria-hidden="true" className="text-muted-foreground">
      ·
    </span>
  );
}
