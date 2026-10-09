import { TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SystemPart } from '@porcelain/client/reviews/rules';

export function DecisionQuestion({
  part,
  action,
}: {
  part: SystemPart;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-graph-4/40 bg-graph-4/5 p-3">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-graph-4" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          Needs your decision · {part.label}
        </p>
        <p className="text-sm text-muted-foreground">{part.problem}</p>
      </div>
      {action}
    </div>
  );
}
