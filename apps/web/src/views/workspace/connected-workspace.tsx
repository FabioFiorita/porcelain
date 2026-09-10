import { useNavigate, useSearch } from '@tanstack/react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { selectedWorktree, worktreeLabel } from '../../domain/inventory';
import { connectionErrorMessage, useConnection } from '../../query/connection';
import { useInventory, useRefreshInventory } from '../../query/inventory';
import { ProjectNavigator } from './project-navigator';

export function ConnectedWorkspace() {
  const { disconnect } = useConnection();
  const { worktree: selected } = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const inventory = useInventory();
  const refresh = useRefreshInventory();
  const worktree = selectedWorktree(inventory, selected);
  const error = refresh.error;
  return (
    <section className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">Environment</h2>
          <Badge variant="secondary">
            {error ? 'Needs attention' : 'Connected'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={refresh.isPending}
            onClick={() => void refresh.submit().catch(() => undefined)}
          >
            {refresh.isPending ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              disconnect();
              void navigate({ search: {} });
            }}
          >
            Disconnect
          </Button>
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {connectionErrorMessage(error)} Displayed inventory may be out of
            date.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <ProjectNavigator
          projects={inventory.projects}
          selected={selected ?? null}
          onSelect={(id) => {
            void navigate({ search: { worktree: id } });
          }}
        />
        <div className="min-w-0">
          {worktree ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">
                {worktreeLabel(worktree.branch)}
              </h2>
              <p className="break-all text-sm text-muted-foreground">
                {worktree.path}
              </p>
              <Badge variant="outline">
                {worktree.available ? 'Available' : 'Unavailable'}
              </Badge>
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Select a worktree</EmptyTitle>
                <EmptyDescription>
                  Choose a worktree to establish your review context.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </section>
  );
}
