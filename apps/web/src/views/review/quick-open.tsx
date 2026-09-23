import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { ReviewScope } from '../../domain/review';
import { useWorktreePaths } from '../../query/review';

const SHOWN = 50;

export function QuickOpen({
  scope,
  onOpen,
}: {
  scope: ReviewScope;
  onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const names = useWorktreePaths(scope, open);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.key !== 'p' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const needle = query.trim().toLowerCase();
  const matches = (names.data?.paths ?? [])
    .filter((path) => path.toLowerCase().includes(needle))
    .slice(0, SHOWN);
  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Find a file"
      description="Search every file in this worktree by name."
    >
      <Command shouldFilter={false}>
        <CommandInput
          aria-label="Find a file by name"
          placeholder="Find a file by name"
          value={query}
          onValueChange={setQuery}
        />
        {names.isError && (
          <div className="p-3 text-xs text-muted-foreground">
            <span className="block">
              Full file search could not be loaded. You can still browse
              folders.
            </span>
            <Button
              variant="outline"
              size="xs"
              className="mt-2"
              onClick={() => void names.refetch()}
            >
              Try again
            </Button>
          </div>
        )}
        {names.isPending && !names.isError && (
          <div className="p-3 text-xs text-muted-foreground">
            Reading file names…
          </div>
        )}
        {!names.isPending && !names.isError && matches.length === 0 && (
          <div className="p-3 text-xs text-muted-foreground">
            No file matches that name.
          </div>
        )}
        <CommandList>
          {matches.map((path) => (
            <CommandItem
              key={path}
              value={path}
              onSelect={() => {
                setOpen(false);
                setQuery('');
                onOpen(path);
              }}
            >
              {path}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
