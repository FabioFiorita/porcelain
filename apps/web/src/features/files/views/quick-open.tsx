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
import {
  hiddenPathFor,
  pinnedFileEntries,
  pinnedParentDirectories,
  quickOpenMatches,
  quickOpenPath,
  visibleFileTreePaths,
  type FilesScope,
} from '@porcelain/client/files/rules';
import { useWorktreePaths } from '../queries/paths';
import { useDirectories } from '../queries/directory';
import { quickOpenDialog, quickOpenOperations } from '../overlays';
import { useQuickOpenActions } from '../commands/quick-open';
import { useQuickOpenShortcut } from '../adapters/quick-open-shortcut';
import { type Connection } from '@/shared/workspace/connection';
import { useFilePreferencesRead } from '@/features/projects/index';
import { TruncatedText } from '@/shared/views/truncated-text';
import { useFileNavigationState } from '../store';

type Props = {
  scope: FilesScope;
  connection: Connection;
  openFiles: readonly string[];
  onOpen: (path: string) => void;
  bindPopup: (element: HTMLElement | null) => void;
};

export function FilesQuickOpen(props: Props) {
  useQuickOpenShortcut(() => quickOpenOperations.toggle());
  return (
    <CommandDialog
      handle={quickOpenDialog}
      title="Find a file"
      description="Find a file by name, or enter a relative path to open it."
    >
      <QuickOpen {...props} />
    </CommandDialog>
  );
}

function QuickOpen({ scope, connection, openFiles, onOpen, bindPopup }: Props) {
  const { query, setQuery, select } = useQuickOpenActions(
    onOpen,
    quickOpenOperations,
  );
  const preferences = useFilePreferencesRead(connection, scope.projectId);
  const visibility =
    AsyncResult.isSuccess(preferences.result) && !preferences.result.waiting
      ? preferences.result.value
      : undefined;
  const hidden = new Set(
    visibility?.preferences
      .filter((preference) => preference.hidden)
      .map((preference) => preference.path) ?? [],
  );
  const navigation = useFileNavigationState(
    `${connection.environmentId}:${scope.projectId}:${scope.worktreeId}`,
  );
  const showHidden = navigation.state.showHidden;
  return (
    <Command ref={bindPopup} shouldFilter={false}>
      <CommandInput
        aria-label="Find a file by name"
        placeholder="Find a file by name"
        value={query}
        onValueChange={setQuery}
      />
      {visibility === undefined && (
        <div className="p-3 text-xs text-muted-foreground">
          {AsyncResult.isFailure(preferences.result) ? (
            <>
              <span className="block">
                File visibility preferences could not be loaded.
              </span>
              <Button
                variant="outline"
                size="xs"
                className="mt-2"
                onClick={() => preferences.refresh()}
              >
                Try again
              </Button>
            </>
          ) : (
            'Reading file visibility…'
          )}
        </div>
      )}
      {visibility !== undefined && query.trim() === '' && (
        <QuickOpenSuggestions
          scope={scope}
          connection={connection}
          openFiles={visibleFileTreePaths(openFiles, hidden, showHidden)}
          preferences={visibility.preferences.filter(
            (preference) =>
              showHidden || hiddenPathFor(preference.path, hidden) === null,
          )}
          onSelect={select}
        />
      )}
      {visibility !== undefined && query.trim() !== '' && (
        <QuickOpenSearch
          scope={scope}
          connection={connection}
          query={query}
          hidden={hidden}
          showHidden={showHidden}
          onSelect={select}
        />
      )}
    </Command>
  );
}

function QuickOpenSuggestions({
  scope,
  connection,
  openFiles,
  preferences,
  onSelect,
}: {
  scope: FilesScope;
  connection: Connection;
  openFiles: readonly string[];
  preferences: Parameters<typeof pinnedParentDirectories>[0];
  onSelect: (path: string) => void;
}) {
  const pinned = preferences.filter((preference) => preference.pinned);
  const parents =
    pinned.length === 0 ? [] : ['', ...pinnedParentDirectories(pinned)];
  const directories = useDirectories(connection, scope, parents);
  const files = pinnedFileEntries(
    pinned.map(({ path }) => path),
    directories.states,
  )
    .filter((pin) => pin.state === 'resolved' && pin.entry.kind === 'file')
    .map(({ path }) => path);
  const suggestions = [...new Set([...openFiles, ...files])];
  return (
    <>
      <CommandList>
        {suggestions.map((path) => (
          <QuickOpenItem key={path} path={path} onSelect={onSelect} />
        ))}
      </CommandList>
      {suggestions.length === 0 && (
        <div className="p-3 text-xs text-muted-foreground">
          Type a file name or relative path.
        </div>
      )}
      {directories.states.some(
        (directory) => directory.status === 'unavailable',
      ) && (
        <div className="p-3 text-xs text-muted-foreground">
          Pinned files could not be loaded.
          <Button
            variant="outline"
            size="xs"
            className="ml-2"
            onClick={() => directories.retry()}
          >
            Try again
          </Button>
        </div>
      )}
    </>
  );
}

function QuickOpenSearch({
  scope,
  connection,
  query,
  hidden,
  showHidden,
  onSelect,
}: {
  scope: FilesScope;
  connection: Connection;
  query: string;
  hidden: ReadonlySet<string>;
  showHidden: boolean;
  onSelect: (path: string) => void;
}) {
  const names = useWorktreePaths(connection, scope);
  const matches = quickOpenMatches(
    visibleFileTreePaths(
      Option.getOrUndefined(AsyncResult.value(names.result))?.paths ?? [],
      hidden,
      showHidden,
    ),
    query,
  );
  const explicit = quickOpenPath(query);
  const directPath =
    explicit !== null &&
    (showHidden || hiddenPathFor(explicit, hidden) === null) &&
    !matches.includes(explicit)
      ? explicit
      : null;
  return (
    <>
      {AsyncResult.isFailure(names.result) && (
        <div className="p-3 text-xs text-muted-foreground">
          <span className="block">
            Full file search could not be loaded. You can still browse folders.
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
      {AsyncResult.isInitial(names.result) && (
        <div className="p-3 text-xs text-muted-foreground">
          Reading file names…
        </div>
      )}
      {!AsyncResult.isInitial(names.result) &&
        !AsyncResult.isFailure(names.result) &&
        matches.length === 0 &&
        directPath === null && (
          <div className="p-3 text-xs text-muted-foreground">
            No file matches that name.
          </div>
        )}
      <CommandList>
        {directPath !== null && (
          <CommandItem value={directPath} onSelect={() => onSelect(directPath)}>
            Open path {directPath}
          </CommandItem>
        )}
        {matches.map((path) => (
          <QuickOpenItem key={path} path={path} onSelect={onSelect} />
        ))}
      </CommandList>
    </>
  );
}

function QuickOpenItem({
  path,
  onSelect,
}: {
  path: string;
  onSelect: (path: string) => void;
}) {
  const separator = path.lastIndexOf('/') + 1;
  return (
    <TruncatedText
      text={path}
      className="min-w-0"
      renderTrigger={(label, clip) => (
        <CommandItem
          value={path}
          aria-label={path}
          onSelect={() => onSelect(path)}
        >
          {label}
          {separator > 0 &&
            clip(
              path.slice(0, separator - 1),
              'shrink-[100] text-muted-foreground',
            )}
        </CommandItem>
      )}
    >
      {path.slice(separator)}
    </TruncatedText>
  );
}
