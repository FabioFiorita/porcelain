import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { FilesScope } from '@porcelain/client/files/rules';
import { useWorktreePaths } from '../queries/paths';
import { quickOpenDialog, quickOpenOperations } from '../overlays';
import { useQuickOpenActions } from '../commands/quick-open';
import { useQuickOpenShortcut } from '../adapters/quick-open-shortcut';
import { quickOpenMatches } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';

export function QuickOpen({
  scope,
  connection,
  onOpen,
}: {
  scope: FilesScope;
  connection: Connection;
  onOpen: (path: string) => void;
}) {
  const { query, setQuery, toggle, select } = useQuickOpenActions(
    onOpen,
    quickOpenOperations,
  );
  const names = useWorktreePaths(connection, scope);
  useQuickOpenShortcut(toggle);
  const matches = quickOpenMatches(
    Option.getOrUndefined(AsyncResult.value(names.result))?.paths ?? [],
    query,
  );
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
        {AsyncResult.isFailure(names.result) && (
          <div className="p-3 text-xs text-muted-foreground">
            <span className="block">
              Full file search could not be loaded. You can still browse
              folders.
            </span>
            <Button
              variant="outline"
              size="xs"
              className="mt-2"
              onClick={() => names.refresh()}
            >
              Try again
            </Button>
          </div>
        )}
        {AsyncResult.isInitial(names.result) &&
          !AsyncResult.isFailure(names.result) && (
            <div className="p-3 text-xs text-muted-foreground">
              Reading file names…
            </div>
          )}
        {!AsyncResult.isInitial(names.result) &&
          !AsyncResult.isFailure(names.result) &&
          matches.length === 0 && (
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
