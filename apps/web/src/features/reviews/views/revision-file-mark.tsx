import { useRevisionFileMarks } from '../commands/revision-file-marks';
import { AsyncResult } from 'effect/reactivity';
import {
  reviewedControlLabel,
  type ReviewMarks,
  type ReviewRevision,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function RevisionFileMark({
  file,
  revision,
  context,
  marks,
}: {
  file: ReviewRevision['files'][number];
  revision: ReviewRevision;
  context: ConnectionContext;
  marks: ReviewMarks;
}) {
  const { markResult, mark, unmarkResult, unmark } = useRevisionFileMarks(
    revision,
    context,
  );
  const fingerprint = file.newOid ?? file.oldOid;
  const reviewed = marks.files.some(
    (item) => item.path === file.path && item.fingerprint === fingerprint,
  );
  const label = reviewedControlLabel(
    file.path,
    reviewed ? 'reviewed' : 'unreviewed',
  );
  const toggle = () => {
    if (!fingerprint) return;
    const target = {
      path: file.path,
      headBlobOid: fingerprint,
      kind: 'file' as const,
    };
    if (reviewed) unmark(target);
    else mark({ ...target, revision: revision.revision });
  };
  return (
    <span className="inline-flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Checkbox
              aria-label={label}
              checked={reviewed}
              disabled={
                !fingerprint || markResult.waiting || unmarkResult.waiting
              }
              onCheckedChange={toggle}
            />
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      {(AsyncResult.isFailure(markResult) ||
        AsyncResult.isFailure(unmarkResult)) && (
        <span role="alert" className="text-xs text-destructive">
          File mark failed. Try again.
        </span>
      )}
    </span>
  );
}
