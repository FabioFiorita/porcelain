import {
  CircleCheckIcon,
  CircleMinusIcon,
  CircleXIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  LoaderCircleIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  pullRequestState,
  pullRequestStateLabel,
  type PullChecksTone,
  type PullRequestState,
} from '@porcelain/client/projects/rules';
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

const resultIcons: Record<
  PullChecksTone,
  { Icon: LucideIcon; label: string; color: string }
> = {
  passed: { Icon: CircleCheckIcon, label: 'Passed', color: 'text-add-fg' },
  failed: { Icon: CircleXIcon, label: 'Failed', color: 'text-del-fg' },
  running: {
    Icon: LoaderCircleIcon,
    label: 'Running',
    color: 'text-muted-foreground',
  },
  none: {
    Icon: CircleMinusIcon,
    label: 'Unknown',
    color: 'text-muted-foreground',
  },
};

export function CheckResultIcon({
  tone,
  label,
}: {
  tone: PullChecksTone;
  label?: string | undefined;
}) {
  const { Icon, label: name, color } = resultIcons[tone];
  return (
    <Icon
      role="img"
      aria-label={label ?? name}
      className={cn('size-3.5 shrink-0', color)}
    />
  );
}

export function Dot() {
  return (
    <span aria-hidden="true" className="text-muted-foreground">
      ·
    </span>
  );
}
