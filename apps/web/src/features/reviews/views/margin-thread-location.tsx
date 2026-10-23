import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  anchorLabel,
  basename,
  type CommentThread,
} from '@porcelain/client/reviews/rules';

type CodeAnchor = Extract<CommentThread['anchor'], { kind: 'codeRange' }>;

export function MarginThreadLocation({
  anchor,
  onReveal,
}: {
  anchor: CodeAnchor;
  onReveal: (control: HTMLElement) => void;
}) {
  const lines = `${anchor.side === 'deletions' ? '−' : ''}${anchor.startLine}${anchor.endLine === anchor.startLine ? '' : `–${anchor.endLine}`}`;
  const location = `${anchor.filePath}:${lines}`;
  return (
    <>
      <span className="group-data-[displaced=true]/margin-thread:hidden">
        {anchorLabel(anchor)}
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="hidden min-w-0 shrink group-data-[displaced=true]/margin-thread:inline-flex"
              aria-label={`Show ${location} in the code`}
              onClick={(event) => onReveal(event.currentTarget)}
            />
          }
        >
          <span className="truncate font-mono">
            {basename(anchor.filePath)}:{lines}
          </span>
        </TooltipTrigger>
        <TooltipContent>{location}</TooltipContent>
      </Tooltip>
    </>
  );
}
