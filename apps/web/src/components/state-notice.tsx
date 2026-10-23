import type { ReactNode } from 'react';
import { InfoIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function StateNotice({
  title,
  description,
  icon,
  children,
  role,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <section
      role={role}
      className="flex w-full min-w-0 max-w-xl flex-col gap-3 p-6 text-left"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-muted-foreground [&>svg]:size-4"
        >
          {icon ?? <InfoIcon />}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <h2
                tabIndex={0}
                className="min-w-0 truncate text-base font-semibold"
              >
                {title}
              </h2>
            }
          />
          <TooltipContent className="max-w-sm break-words">
            {title}
          </TooltipContent>
        </Tooltip>
      </div>
      {description && (
        <div className="text-ui leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          {description}
        </div>
      )}
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </section>
  );
}

export function StateSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex w-full min-w-0 flex-col gap-3 p-6"
    >
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-1/2" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
