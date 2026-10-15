import { Badge } from '@/components/ui/badge';
import type { MouseEvent } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { refLabel } from '@porcelain/client/history/rules';
import { useRefChipLayout } from '../adapters/ref-chip-layout';

const chipClass = 'h-4 min-w-0 max-w-40';

export function CommitRefs({
  refs,
  onOpenCommit,
}: {
  refs: readonly string[];
  onOpenCommit: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { row, measurement, visibleCount } = useRefChipLayout(refs);
  const hidden = refs.slice(visibleCount);
  return (
    <div
      ref={row}
      className="pointer-events-none relative flex min-w-0 items-center gap-1"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-0 overflow-hidden"
      >
        <div ref={measurement} className="flex w-max gap-1">
          {refs.map((ref) => (
            <Badge key={ref} variant="secondary" className={chipClass}>
              <span
                data-label={refLabel(ref)}
                className="truncate before:content-[attr(data-label)]"
              />
            </Badge>
          ))}
          <Badge variant="secondary" className="h-4">
            +{refs.length}
          </Badge>
        </div>
      </div>
      {refs.slice(0, visibleCount).map((ref) => (
        <Tooltip key={ref}>
          <TooltipTrigger
            render={
              <Badge
                render={<button type="button" onClick={onOpenCommit} />}
                variant="secondary"
                className={`${chipClass} pointer-events-auto shrink`}
              />
            }
          >
            <span className="truncate">{refLabel(ref)}</span>
          </TooltipTrigger>
          <TooltipContent className="break-all">{ref}</TooltipContent>
        </Tooltip>
      ))}
      {hidden.length > 0 && (
        <Popover>
          <PopoverTrigger
            render={
              <Badge
                render={<button type="button" />}
                variant="secondary"
                className="pointer-events-auto h-4 hover:bg-accent"
                aria-label={`Show ${hidden.length} more ${hidden.length === 1 ? 'ref' : 'refs'}`}
              />
            }
          >
            +{hidden.length}
          </PopoverTrigger>
          <PopoverContent align="start" className="max-w-[calc(100vw-2rem)]">
            <PopoverTitle>More refs</PopoverTitle>
            <ul className="max-h-64 overflow-y-auto text-xs">
              {hidden.map((ref) => (
                <li key={ref} className="py-1 break-all">
                  {ref}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
