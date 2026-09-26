import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { FilesScope } from '../rules/scope';
import { useWorktreePaths } from '../queries/paths';
import { FILE_QUICK_OPEN_MAX } from '@/config/limits';
import { useAccessStore } from '@/features/access/index';
import { quickOpenDialog } from '../overlays';
import { useQuickOpenQuery } from '../store';
import { useQuickOpenShortcut } from '../adapters/quick-open-shortcut';

export function QuickOpen({
  scope,
  onOpen,
}: {
  scope: FilesScope;
  onOpen: (path: string) => void;
}) {
  const { query, setQuery } = useQuickOpenQuery();
  const connection = useAccessStore((state) => state.connection);
  const names = useWorktreePaths(connection, scope);
  useQuickOpenShortcut(() => {
    if (quickOpenDialog.isOpen) quickOpenDialog.close();
    else quickOpenDialog.open(null);
  });
  const needle = query.trim().toLowerCase();
  const matches = (names.data?.paths ?? [])
    .filter((path) => path.toLowerCase().includes(needle))
    .slice(0, FILE_QUICK_OPEN_MAX);
  return (
    <CommandDialog
      handle={quickOpenDialog}
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
                quickOpenDialog.close();
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
