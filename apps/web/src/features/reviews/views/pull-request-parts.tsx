import {
  CheckIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  LoaderCircleIcon,
  PlusIcon,
  TriangleAlertIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import {
  pullRequestStateLabel,
  type PullChecksTone,
} from '@porcelain/client/reviews/rules';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

type PullState = { state: 'open' | 'closed' | 'merged'; draft: boolean };
type Tone = 'open' | 'draft' | 'merged' | 'closed';

function pullTone(pull: PullState): Tone {
  if (pull.state === 'open') return pull.draft ? 'draft' : 'open';
  return pull.state;
}

const stateIcons: Record<Tone, LucideIcon> = {
  open: GitPullRequestIcon,
  draft: GitPullRequestDraftIcon,
  merged: GitMergeIcon,
  closed: GitPullRequestClosedIcon,
};
const pillVariants = {
  open: 'outline',
  draft: 'secondary',
  merged: 'brand-soft',
  closed: 'destructive',
} as const;
const stateText: Record<Tone, string> = {
  open: 'text-add-fg',
  draft: 'text-muted-foreground',
  merged: 'text-brand',
  closed: 'text-del-fg',
};

export function pullStateIcon(pull: PullState) {
  return stateIcons[pullTone(pull)];
}

export function pullStateText(pull: PullState) {
  return stateText[pullTone(pull)];
}

export function PullStatePill({
  pull,
  large = false,
}: {
  pull: PullState;
  large?: boolean;
}) {
  const tone = pullTone(pull);
  const Icon = stateIcons[tone];
  return (
    <Badge variant={pillVariants[tone]} className={large ? 'h-6' : undefined}>
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

type ChipVariant = 'linked' | 'found' | 'empty';

export function PullRequestChip({
  variant,
  description,
  icon: Icon,
  onClick,
  disabled = false,
  children,
}: {
  variant: ChipVariant;
  description: string;
  icon: LucideIcon | undefined;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const ChipIcon = Icon ?? PlusIcon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={description}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              'ml-auto inline-flex h-5.5 shrink-0 items-center gap-1.5 rounded-full border border-border-strong pr-2.25 pl-1.75 text-xs leading-5 font-medium whitespace-nowrap text-foreground tabular-nums outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50',
              variant === 'found' && 'border-dashed',
              variant === 'empty' && 'border-transparent text-muted-foreground',
            )}
          />
        }
      >
        <ChipIcon
          aria-hidden="true"
          className="size-3 shrink-0 text-muted-foreground"
        />
        {children}
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}
