import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  settingsUpdateAvailable,
  settingsUpdatesVisible,
  settingsUpdateBatchProgress,
  type SettingsUpdateEntry,
} from '@porcelain/client/access';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/components/ui/sidebar';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSettingsUpdates } from '../queries/settings-updates';
import { SettingsUpdateRow } from './settings-update-row';

export function UpdatesMenu() {
  const { rows, targets, count, batch, run, failures, checking, refresh } =
    useSettingsUpdates();
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const offered = rows.filter(({ target }) => settingsUpdateAvailable(target));
  const shown = rows.filter(
    (row) =>
      offered.includes(row) ||
      batch.entries.some(
        (entry) => entry.id === row.target.id && entry.kind === row.target.kind,
      ),
  );
  const progress = settingsUpdateBatchProgress(batch);
  const progressLabel = progress.label
    ? `${progress.label}…`
    : 'Preparing updates…';
  const visible = settingsUpdatesVisible(targets, batch);
  let title = 'Updates available';
  if (!visible && batch.entries.length === 0) title = 'No updates available';
  if (failures.length > 0) title = 'Could not check for updates';
  if (!visible && !open) return null;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) refresh();
      }}
    >
      <PopoverTrigger
        className={cn(!visible && 'invisible')}
        render={<Badge render={<button type="button" />} />}
      >
        {batch.running ? 'Updating…' : 'Update'}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-88 max-w-[calc(100vw-1rem)]"
      >
        <PopoverTitle>{title}</PopoverTitle>
        {failures.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>The update check failed</AlertTitle>
            <AlertDescription>
              {failures.map((failure) => (
                <p key={failure.id}>
                  {failure.name}: {failure.message}
                </p>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={checking}
                onClick={refresh}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <div className="flex max-h-[60svh] flex-col divide-y overflow-y-auto">
          {shown.map((row) => (
            <div key={`${row.target.kind}:${row.target.id}`} className="py-3">
              <SettingsUpdateRow row={row} showName />
            </div>
          ))}
          {batch.entries
            .filter(
              (entry) =>
                !rows.some(
                  ({ target }) =>
                    target.id === entry.id && target.kind === entry.kind,
                ),
            )
            .map((entry) => (
              <div key={`${entry.kind}:${entry.id}`} className="py-3">
                <p className="text-sm font-medium">{entry.name}</p>
                <p
                  role={entry.status === 'failed' ? 'alert' : 'status'}
                  className="text-xs text-muted-foreground"
                >
                  {batchEntryText(entry)}
                </p>
              </div>
            ))}
        </div>
        <footer className="flex items-center justify-between gap-2 border-t pt-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setOpenMobile(false);
              void navigate({
                to: '/settings/$section',
                params: { section: 'computers' },
              });
            }}
          >
            Manage computers
          </Button>
          <Button
            size="sm"
            disabled={batch.running || count === 0}
            aria-live="polite"
            onClick={() => run(targets)}
          >
            {batch.running ? progressLabel : `Update all (${count})`}
          </Button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}

function batchEntryText(entry: SettingsUpdateEntry) {
  if (entry.status === 'failed') return entry.message;
  if (entry.status === 'updated') return `Updated to ${entry.version}.`;
  if (entry.status === 'queued') return 'Queued';
  return `Updating to ${entry.version}…`;
}
