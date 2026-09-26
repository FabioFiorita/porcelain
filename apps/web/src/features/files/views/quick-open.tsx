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
import { useAccessStore } from '@/features/access/index';
import { quickOpenDialog, quickOpenOperations } from '../overlays';
import { useQuickOpenActions } from '../commands/quick-open';
import { useQuickOpenShortcut } from '../adapters/quick-open-shortcut';
import { quickOpenMatches } from '../rules/quick-open';

export function QuickOpen({
  scope,
  onOpen,
}: {
  scope: FilesScope;
  onOpen: (path: string) => void;
}) {
  const { query, setQuery, toggle, select } = useQuickOpenActions(
    onOpen,
    quickOpenOperations,
  );
  const connection = useAccessStore((state) => state.connection);
  const names = useWorktreePaths(connection, scope);
  useQuickOpenShortcut(toggle);
  const matches = quickOpenMatches(names.data?.paths ?? [], query);
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
            <CommandItem key={path} value={path} onSelect={() => select(path)}>
              {path}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
