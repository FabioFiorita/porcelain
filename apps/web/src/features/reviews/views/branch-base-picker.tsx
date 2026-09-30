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
import { branchName, useBranchBases } from '@/features/changes/index';
import type { ReviewScope } from '../rules/review';
import type { ReviewsContext } from '../rules/reviewed';

export function BranchBasePicker({
  scope,
  connection,
  base,
  onBase,
}: {
  scope: ReviewScope;
  connection: ReviewsContext['connection'];
  base: string | undefined;
  onBase: (base: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const bases = useBranchBases(scope, connection, open);
  const label = base == null ? 'the default branch' : branchName(base);
  const defaultRef = bases.data?.defaultRef ?? null;
  const chosen = base ?? defaultRef;
  const groups = [
    {
      heading: 'Local',
      entries: bases.data?.bases.filter((entry) => !entry.remote) ?? [],
    },
    {
      heading: 'Remote',
      entries: bases.data?.bases.filter((entry) => entry.remote) ?? [],
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
            className="w-full justify-between"
            aria-label={`Compare against ${label}`}
            title="Choose the branch this one is compared against"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">
            <span className="text-muted-foreground">Against </span>
            {label}
          </span>
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
            {bases.isPending && (
              <p role="status" className="p-3 text-xs text-muted-foreground">
                Reading branches…
              </p>
            )}
            {bases.isError && (
              <div className="p-3 text-xs text-muted-foreground">
                <span className="block">The branches could not be read.</span>
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-2"
                  onClick={() => void bases.refetch()}
                >
                  Try again
                </Button>
              </div>
            )}
            {bases.isSuccess && <CommandEmpty>No branch matches.</CommandEmpty>}
            {groups.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.entries.map((entry) => (
                  <CommandItem
                    key={entry.ref}
                    value={entry.name}
                    data-checked={entry.ref === chosen}
                    onSelect={() => choose(entry.ref)}
                  >
                    <span className="truncate">{entry.name}</span>
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
