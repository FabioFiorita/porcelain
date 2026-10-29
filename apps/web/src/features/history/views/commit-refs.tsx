import { TruncatedText } from '@/shared/views/truncated-text';
import { Badge } from '@/components/ui/badge';
import type { MouseEvent } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useRefChipLayout } from '../adapters/ref-chip-layout';

const chipClass = 'min-w-0 max-w-40';

export function CommitRefs({
  refs,
  current = () => false,
  onOpenCommit,
}: {
  refs: readonly string[];
  current?: (ref: string) => boolean;
  onOpenCommit: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { row, visibleCount } = useRefChipLayout(refs);
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
        <div data-ref-measurement className="flex w-max gap-1">
          {refs.map((ref) => (
            <Badge key={ref} variant="secondary" className={chipClass}>
              <span
                data-label={ref}
                className="before:content-[attr(data-label)]"
              />
            </Badge>
          ))}
          <Badge variant="secondary" className={chipClass}>
            +{refs.length}
          </Badge>
        </div>
      </div>
      {refs.slice(0, visibleCount).map((ref) => (
        <TruncatedText
          key={ref}
          text={ref}
          renderTrigger={(label) => (
            <Badge
              render={<button type="button" onClick={onOpenCommit} />}
              variant={current(ref) ? 'brand-soft' : 'outline'}
              className={`${chipClass} pointer-events-auto shrink`}
            >
              {label}
            </Badge>
          )}
        >
          {ref}
        </TruncatedText>
      ))}
      {hidden.length > 0 && (
        <Popover>
          <PopoverTrigger
            render={
              <Badge
                render={<button type="button" />}
                variant="secondary"
                className={`${chipClass} pointer-events-auto hover:bg-accent`}
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
