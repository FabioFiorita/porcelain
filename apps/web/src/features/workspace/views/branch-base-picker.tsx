import { PendingSpinner } from '@/shared/views/state-notice';
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
import type { ReviewScope } from '@porcelain/client/changes/rules';
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
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState('');
  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (!next) setQuery('');
  };
  const bases = useBranchBases(scope, connection, open);
  const comparison = useBranchChanges(scope, connection, base);
  const branches = Option.getOrUndefined(AsyncResult.value(bases.result));
  const compared = Option.getOrUndefined(AsyncResult.value(comparison.result));
  const currentBase = base ?? compared?.base?.ref;
  const label =
    currentBase === undefined ? 'the default branch' : refLabel(currentBase);
  const defaultRef = branches?.defaultRef ?? null;
  const chosen = base ?? defaultRef;
  const entries = new Map(
    (branches?.bases ?? []).map((entry) => [entry.ref, entry]),
  );
  const items = [
    { label: 'Local', remote: false },
    { label: 'Remote', remote: true },
  ]
    .map(({ label, remote }) => ({
      type: 'group' as const,
      label,
      items: (branches?.bases ?? [])
        .filter((entry) => entry.remote === remote)
        .map((entry) => ({ value: entry.ref, label: entry.name })),
    }))
    .filter((group) => group.items.length > 0);
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
        <Command
          items={items}
          query={query}
          onQueryChange={setQuery}
          onEscape={() => setOpen(false)}
        >
          <CommandInput
            aria-label="Find a base branch"
            placeholder="Find a branch"
          />
          {AsyncResult.isInitial(bases.result) && (
            <p className="p-3">
              <PendingSpinner label="Reading branches" />
            </p>
          )}
          {AsyncResult.isFailure(bases.result) && (
            <div
              role="alert"
              className="flex items-center justify-center gap-2 py-6 text-xs/relaxed text-muted-foreground"
            >
              Branches could not be read.
              <Button variant="link" size="flush" onClick={bases.refresh}>
                Try again
              </Button>
            </div>
          )}
          {AsyncResult.isSuccess(bases.result) && (
            <CommandEmpty>No matching branch</CommandEmpty>
          )}
          <CommandList aria-label="Base branches">
            {(state) =>
              state.items.map((group) =>
                typeof group === 'object' &&
                'type' in group &&
                group.type === 'group' ? (
                  <CommandGroup key={group.label} heading={group.label}>
                    {group.items.map((item) => {
                      const value =
                        typeof item === 'string' ? item : item.value;
                      const entry = entries.get(value);
                      return (
                        entry && (
                          <CommandItem
                            key={entry.ref}
                            value={entry.ref}
                            label={entry.name}
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
                        )
                      );
                    })}
                  </CommandGroup>
                ) : null,
              )
            }
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
