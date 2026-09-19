import { useNavigate } from '@tanstack/react-router';
import {
  ChevronRight,
  CornerLeftUp,
  Folder,
  FolderGit2,
  FolderOpen,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  useBrowseDirectories,
  useDiscoveredRepositories,
  useRegisterProject,
} from '../../query/inventory';
import { reviewErrorMessage } from '../../query/review';
import { DialogIcon } from './dialog-icon';

/**
 * Repositories the server already found come first, because that is almost
 * always the one you want. The folder browser is there for everything else,
 * and starts folded away so it does not compete with the list.
 */
export function OpenProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const register = useRegisterProject();
  const navigate = useNavigate({ from: '/' });
  const [browsing, setBrowsing] = useState(false);

  const openRepository = (path: string) => {
    register.submit(path).then(
      (project) => {
        const main =
          project.worktrees.find((worktree) => worktree.main) ??
          project.worktrees[0];
        close();
        toast.add({
          title: `Opened ${project.name}`,
          description: `${project.worktrees.length} worktree${project.worktrees.length === 1 ? '' : 's'}.`,
        });
        if (main != null) void navigate({ search: { worktree: main.id } });
      },
      () => undefined,
    );
  };

  const close = () => {
    onOpenChange(false);
    setBrowsing(false);
    register.reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="gap-4 sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <DialogIcon icon={FolderGit2} />
          <div className="flex flex-col gap-0.5">
            <DialogTitle>Open project</DialogTitle>
            <DialogDescription>
              Every worktree of the repository shows up in the sidebar.
            </DialogDescription>
          </div>
        </DialogHeader>

        {open && (
          <DiscoveredList
            onOpen={openRepository}
            pending={register.isPending}
          />
        )}

        <Collapsible
          open={browsing}
          onOpenChange={setBrowsing}
          className="group/browse rounded-xl border"
        >
          <CollapsibleTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
              />
            }
          >
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-data-[open]/browse:rotate-90" />
            <FolderOpen className="size-4 text-muted-foreground" />
            Browse for a folder
          </CollapsibleTrigger>
          <CollapsibleContent>
            {browsing && (
              <FolderBrowser
                onOpen={openRepository}
                pending={register.isPending}
              />
            )}
          </CollapsibleContent>
        </Collapsible>

        {register.error != null && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {reviewErrorMessage(register.error)}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiscoveredList({
  onOpen,
  pending,
}: {
  onOpen: (path: string) => void;
  pending: boolean;
}) {
  const { repositories, isPending } = useDiscoveredRepositories(true);

  return (
    <Command className="rounded-xl border bg-transparent p-0">
      <CommandInput placeholder="Search repositories on this machine…" />
      <CommandList className="max-h-60">
        {isPending ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Spinner /> Looking for repositories…
          </div>
        ) : (
          <>
            <CommandEmpty>No repository matches.</CommandEmpty>
            <CommandGroup heading="Found on this machine">
              {repositories.map((repository) => (
                <CommandItem
                  key={repository.path}
                  value={`${repository.name} ${repository.path}`}
                  disabled={pending}
                  onSelect={() => onOpen(repository.path)}
                >
                  <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{repository.name}</span>
                  <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">
                    {repository.path}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}

function FolderBrowser({
  onOpen,
  pending,
}: {
  onOpen: (path: string) => void;
  pending: boolean;
}) {
  // null asks the server for its home directory; every open starts there.
  const [path, setPath] = useState<string | null>(null);
  const { listing, error, isFetching } = useBrowseDirectories(path, true);

  if (listing == null) {
    return (
      <div className="flex items-center gap-2 border-t px-3 py-4 text-sm text-muted-foreground">
        {error == null ? (
          <>
            <Spinner /> Opening your home folder…
          </>
        ) : (
          reviewErrorMessage(error)
        )}
      </div>
    );
  }

  const segments = listing.path.split('/').filter(Boolean);
  const name = segments.at(-1) ?? '/';

  return (
    <div className="flex flex-col gap-2 border-t p-2">
      <Breadcrumb className="px-1">
        <BreadcrumbList className="flex-nowrap gap-1 overflow-x-auto text-xs sm:gap-1">
          <BreadcrumbItem>
            <button
              type="button"
              className="font-mono hover:text-foreground"
              onClick={() => setPath('/')}
            >
              /
            </button>
          </BreadcrumbItem>
          {segments.map((segment, index) => {
            const target = `/${segments.slice(0, index + 1).join('/')}`;
            const last = index === segments.length - 1;
            // Separators are list items of their own, so they sit beside each item, not inside it.
            return (
              <Fragment key={target}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {last ? (
                    <BreadcrumbPage className="font-mono">
                      {segment}
                    </BreadcrumbPage>
                  ) : (
                    <button
                      type="button"
                      className="font-mono hover:text-foreground"
                      onClick={() => setPath(target)}
                    >
                      {segment}
                    </button>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <ScrollArea
        className={cn('h-52 rounded-lg border', isFetching && 'opacity-60')}
      >
        <div className="flex flex-col p-1">
          {listing.parent != null && (
            <button
              type="button"
              onClick={() => setPath(listing.parent)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-muted-foreground hover:bg-accent"
            >
              <CornerLeftUp className="size-4" />
              Up
            </button>
          )}
          {listing.entries.length === 0 && (
            <p className="px-2 py-3 text-[12.5px] text-muted-foreground">
              This folder is empty.
            </p>
          )}
          {listing.entries.map((entry) => (
            <div
              key={entry.path}
              className="group flex items-center gap-1 rounded-md pr-1 hover:bg-accent"
            >
              <button
                type="button"
                onClick={() => setPath(entry.path)}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[12.5px]"
              >
                {entry.isRepository ? (
                  <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate font-mono">{entry.name}</span>
                {entry.open ? (
                  <Badge
                    variant="secondary"
                    className="h-4 px-1.5 text-[10px] font-normal"
                  >
                    Already open
                  </Badge>
                ) : (
                  entry.isRepository && (
                    <Badge
                      variant="outline"
                      className="h-4 px-1.5 text-[10px] font-normal"
                    >
                      Repository
                    </Badge>
                  )
                )}
              </button>
              {entry.isRepository && !entry.open && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-6 px-2 text-[11px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  disabled={pending}
                  onClick={() => onOpen(entry.path)}
                >
                  Open
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 px-1">
        <p className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
          {listing.isRepository
            ? 'This folder is a Git repository.'
            : 'Pick a folder that is a Git repository.'}
        </p>
        <Button
          size="sm"
          disabled={!listing.isRepository || pending}
          onClick={() => onOpen(listing.path)}
        >
          {pending && <Spinner />}
          Open {name}
        </Button>
      </div>
    </div>
  );
}
