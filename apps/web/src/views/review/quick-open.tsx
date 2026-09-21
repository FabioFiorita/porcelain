import { formatForDisplay } from '@tanstack/react-hotkeys';
import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import type { ReviewScope } from '../../domain/review';
import { useWorktreePaths } from '../../query/review';

/** Enough to choose from; more than this and the name is the wrong filter. */
const SHOWN = 50;

/**
 * Finding a file by name, which the tree can no longer do for itself.
 *
 * The tree only knows the folders somebody opened, so searching it would miss
 * everything else. The list of every name is its own read, and it is made when
 * this opens rather than when Files mounts — a repository's worth of names is
 * not worth fetching for a reader who never searches.
 */
export function QuickOpen({
  scope,
  onOpen,
  prominent = false,
}: {
  scope: ReviewScope;
  onOpen: (path: string) => void;
  /** The Files header: a full-width "Go to file…" field instead of an icon. */
  prominent?: boolean;
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
    <>
      {prominent ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-xl bg-input/50 px-2 text-left text-[12px] text-muted-foreground transition-colors hover:bg-input/80"
        >
          <SearchIcon className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Go to file…</span>
          <Kbd className="shrink-0">{formatForDisplay('Mod+P')}</Kbd>
        </button>
      ) : (
        <Button
          size="xs"
          variant="ghost"
          aria-label="Find a file by name"
          onClick={() => setOpen(true)}
        >
          <SearchIcon className="size-3.5" aria-hidden="true" />
        </Button>
      )}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Find a file"
        description="Search every file in this worktree by name."
      >
        {/* Filtered here, against every name in the worktree rather than the
            rows that happen to be on screen. */}
        <Command shouldFilter={false}>
          <CommandInput
            aria-label="Find a file by name"
            placeholder="Find a file by name"
            value={query}
            onValueChange={setQuery}
          />
          {/* These say how the read went, not how the query went, so they sit
              outside the list: CommandEmpty only renders once something has
              been typed, and a button inside the list is something cmdk will
              try to select. */}
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
    </>
  );
}
