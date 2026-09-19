import { useHotkey } from '@tanstack/react-hotkeys';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Spinner } from '@/components/ui/spinner';
import { entryKey } from '../../domain/documents';
import { basename, type ReviewScope } from '../../domain/review';
import { useFileSearch } from '../../query/files';
import { FileTypeIcon } from '../review/file-type-icon';
import {
  setQuickOpen,
  toggleQuickOpen,
  useQuickOpenState,
} from './quick-open-store';
import { SHORTCUTS } from './shortcuts';

/** Waits for a pause in typing, so a search is one request, not one per key. */
const SEARCH_DELAY_MS = 120;

/**
 * `Mod+P`: find a file by name in the selected worktree and open it as a tab.
 * The server searches tracked and untracked files (one `git ls-files`), best
 * matches first. Ignored files are not listed; the Files tree still reaches them.
 */
export function QuickOpen({
  scope,
  worktreeName,
}: {
  scope: ReviewScope;
  worktreeName: string;
}) {
  const isOpen = useQuickOpenState();
  useHotkey(SHORTCUTS.quickOpen, toggleQuickOpen);
  // Leaving the worktree (or the workspace) closes it.
  useEffect(() => () => setQuickOpen(false), []);

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={setQuickOpen}
      title="Go to file"
      description={`Search the files of ${worktreeName}`}
      className="sm:max-w-xl"
    >
      {/* Mounted only while open, so every opening starts with an empty query. */}
      {isOpen && (
        <QuickOpenSearch
          scope={scope}
          worktreeName={worktreeName}
          onDone={() => setQuickOpen(false)}
        />
      )}
    </CommandDialog>
  );
}

function QuickOpenSearch({
  scope,
  worktreeName,
  onDone,
}: {
  scope: ReviewScope;
  worktreeName: string;
  onDone: () => void;
}) {
  const navigate = useNavigate({ from: '/' });
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const searching = debounced !== '';
  const { paths, truncated, isFetching } = useFileSearch(
    scope,
    debounced,
    searching,
  );
  const settled = searching && !isFetching && debounced === query.trim();

  const openFile = (path: string) => {
    onDone();
    // Opening an entry is all it takes: the tab layout adds a tab for it after the active one.
    void navigate({
      search: (previous) => ({
        ...previous,
        entry: entryKey({ kind: 'file', path }),
      }),
    });
  };

  return (
    // The server already ranked the matches; cmdk must not filter or re-sort them.
    <Command shouldFilter={false} className="rounded-none bg-transparent">
      <div className="relative">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={`Go to a file in ${worktreeName}…`}
        />
        {isFetching && (
          <Spinner className="absolute top-1/2 right-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>
      <CommandList className="max-h-[min(24rem,55svh)]">
        {!searching ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">
            Type part of a file name or path. Ignored files, like{' '}
            <code className="font-mono">.env</code>, are only in the Files tree.
          </p>
        ) : (
          <>
            {settled && (
              <CommandEmpty>No file matches “{debounced}”.</CommandEmpty>
            )}
            {paths.length > 0 && (
              <CommandGroup>
                {paths.map((path) => {
                  const name = basename(path);
                  const folder = path
                    .slice(0, path.length - name.length)
                    .replace(/\/$/, '');
                  return (
                    <CommandItem
                      key={path}
                      value={path}
                      onSelect={() => openFile(path)}
                      className="gap-2.5"
                    >
                      <FileTypeIcon path={path} className="size-4 shrink-0" />
                      <span className="shrink-0 text-[13px]">{name}</span>
                      {/* Long folders lose their start, not their end: the nearest folders say the most. */}
                      <span className="min-w-0 truncate text-[12px] text-muted-foreground [direction:rtl]">
                        <bdi>{folder}</bdi>
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {truncated && (
              <p className="px-3 pt-1 pb-2 text-[11.5px] text-muted-foreground">
                Showing the best {paths.length} matches. Keep typing to narrow
                them down.
              </p>
            )}
          </>
        )}
      </CommandList>
    </Command>
  );
}
