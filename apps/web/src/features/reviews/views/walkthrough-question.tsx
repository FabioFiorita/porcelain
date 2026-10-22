import { TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SystemPart } from '@porcelain/client/reviews/rules';

export function DecisionQuestion({
  part,
  action,
  children,
}: {
  part: SystemPart;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-graph-1/40 bg-graph-1/5 p-4">
      <div className="flex items-start gap-3">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-graph-1" />
        <div className="min-w-0 flex-1 wrap-anywhere">
          <p className="text-sm font-medium">
            Needs your decision · {part.label}
          </p>
          <p className="text-sm whitespace-pre-wrap wrap-anywhere text-muted-foreground">
            {part.problem}
          </p>
        </div>
      </div>
      {action}
      {children}
    </div>
  );
}
