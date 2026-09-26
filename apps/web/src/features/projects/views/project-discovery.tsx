import type { ProjectConnection } from '../rules/connection';
import { FolderGit2Icon, RefreshCwIcon, SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { connectionErrorMessage } from '@/features/access/index';
import { useProjectDiscovery } from '../queries/project-locations';
import { useProjectBrowserStore } from '../store';

export function ProjectDiscovery({
  connection,
  disabled,
  onOpen,
}: {
  connection: ProjectConnection | null;
  disabled: boolean;
  onOpen: (path: string) => void;
}) {
  const search = useProjectBrowserStore((state) => state.search);
  const setSearch = useProjectBrowserStore((state) => state.setSearch);
  const discovery = useProjectDiscovery(connection, true);
  const query = search.trim().toLocaleLowerCase();
  const repositories =
    discovery.data?.repositories.filter((repository) =>
      `${repository.name} ${repository.path}`
        .toLocaleLowerCase()
        .includes(query),
    ) ?? [];
  return (
    <section
      aria-label="Found on this machine"
      className="flex flex-col gap-2 rounded-2xl border p-2"
    >
      <InputGroup>
        <InputGroupInput
          aria-label="Search repositories on this machine"
          placeholder="Search repositories on this machine…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={disabled}
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="text-xs font-medium text-muted-foreground">
          Found on this machine
        </h3>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Refresh discovered repositories"
          disabled={disabled || discovery.isFetching}
          onClick={() => void discovery.refetch()}
        >
          {discovery.isFetching ? <Spinner /> : <RefreshCwIcon />}
        </Button>
      </div>
      {discovery.error ? (
        <p role="alert" className="px-1 text-xs text-destructive">
          {connectionErrorMessage(discovery.error)}
        </p>
      ) : discovery.isPending ? (
        <p role="status" className="px-1 py-2 text-xs text-muted-foreground">
          Looking for repositories…
        </p>
      ) : repositories.length ? (
        <ScrollArea className="max-h-28 min-h-0 [&>[data-slot=scroll-area-viewport]]:max-h-28">
          <div className="flex flex-col">
            {repositories.map((repository) => (
              <Button
                key={repository.path}
                variant="ghost"
                className="h-auto min-h-8 w-full justify-start"
                title={repository.path}
                disabled={disabled}
                onClick={() => onOpen(repository.path)}
              >
                <FolderGit2Icon data-icon="inline-start" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-0 flex-1 truncate">
                    {repository.name}
                  </span>
                  <span className="truncate font-mono text-[10px] font-normal text-muted-foreground sm:max-w-[55%]">
                    {repository.path}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          {query
            ? 'No matching repositories.'
            : 'No repositories found nearby. Browse for a folder below.'}
        </p>
      )}
      {discovery.data?.limited && (
        <p className="px-1 text-xs text-muted-foreground">
          Showing nearby repositories. Browse to find others.
        </p>
      )}
    </section>
  );
}
