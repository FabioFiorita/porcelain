import { TruncatedText } from '@/shared/views/truncated-text';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { ChevronsUpDownIcon, GitBranchIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { refLabel } from '@porcelain/client/history/rules';
import { useBranchBases, useBranchChanges } from '@/features/changes/index';
import { cn } from '@/shared/lib/utils';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function BranchBasePicker({
  scope,
  connection,
  base,
  onBase,
  compact = false,
}: {
  scope: ReviewScope;
  connection: ConnectionContext['connection'];
  base: string | undefined;
  onBase: (base: string | undefined) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const bases = useBranchBases(scope, connection, open);
  const comparison = useBranchChanges(scope, connection, base);
  const branches = Option.getOrUndefined(AsyncResult.value(bases.result));
  const compared = Option.getOrUndefined(AsyncResult.value(comparison.result));
  const currentBase = base ?? compared?.base?.ref;
  const label =
    currentBase === undefined ? 'the default branch' : refLabel(currentBase);
  const defaultRef = branches?.defaultRef ?? null;
  const chosen = base ?? defaultRef;
  const groups = [
    {
      heading: 'Local',
      entries: branches?.bases.filter((entry) => !entry.remote) ?? [],
    },
    {
      heading: 'Remote',
      entries: branches?.bases.filter((entry) => entry.remote) ?? [],
    },
  ].filter((group) => group.entries.length > 0);
  const choose = (ref: string) => {
    onBase(ref === defaultRef ? undefined : ref);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'justify-between',
              compact ? 'max-w-24 @min-3xl/pane:max-w-40' : 'w-full',
            )}
            aria-label={`Compare against ${label}`}
            title="Choose the branch this one is compared against"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <GitBranchIcon
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground',
              compact && 'hidden @min-3xl/pane:block',
            )}
          />
          <TruncatedText text={`Against ${label}`}>
            <span
              className={cn(
                'text-muted-foreground',
                compact && 'hidden @min-3xl/pane:inline',
              )}
            >
              Against{' '}
            </span>
            {label}
          </TruncatedText>
        </span>
        <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <Command>
          <CommandInput
            aria-label="Find a base branch"
            placeholder="Find a branch"
          />
          <CommandList aria-label="Base branches">
            {AsyncResult.isInitial(bases.result) && (
              <p role="status" className="p-3 text-xs text-muted-foreground">
                Reading branches…
              </p>
            )}
            {AsyncResult.isFailure(bases.result) && (
              <div className="p-3 text-xs text-muted-foreground">
                <span className="block">The branches could not be read.</span>
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-2"
                  onClick={bases.refresh}
                >
                  Try again
                </Button>
              </div>
            )}
            {AsyncResult.isSuccess(bases.result) && (
              <CommandEmpty>No branch matches.</CommandEmpty>
            )}
            {groups.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.entries.map((entry) => (
                  <CommandItem
                    key={entry.ref}
                    value={entry.name}
                    data-checked={entry.ref === chosen}
                    onSelect={() => choose(entry.ref)}
                  >
                    <TruncatedText text={entry.name} />
                    {entry.ref === defaultRef && (
                      <span className="text-xs text-muted-foreground">
                        default
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
