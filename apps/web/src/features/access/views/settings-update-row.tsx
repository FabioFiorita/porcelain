import type { ReactNode } from 'react';
import {
  settingsUpdateTrust,
  settingsUpdateVersion,
} from '@porcelain/client/access';
import {
  serviceUpdateOutcome,
  serviceUpdateProgress,
} from '@porcelain/client/access/rules';
import { CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Spinner } from '@/components/ui/spinner';
import { copyText } from '@/shared/workspace/copy';
import {
  useSettingsUpdates,
  type SettingsUpdateRow as UpdateRow,
} from '../queries/settings-updates';
import { useAppUpdateState } from '../queries/app-update';
import { useLocalConnection } from '../store';
import { appUpdateProgress } from '../rules/app-update';

export function SettingsUpdateRow({
  row,
  showName = false,
}: {
  row: UpdateRow;
  showName?: boolean;
}) {
  const { target, current } = row;
  const { batch, run } = useSettingsUpdates();
  const appState = useAppUpdateState();
  const local = useLocalConnection();
  const entry = batch.entries.find(
    (item) => item.id === target.id && item.kind === target.kind,
  );
  const version = settingsUpdateVersion(target);
  const trust =
    target.kind === 'service' ? settingsUpdateTrust(target) : undefined;
  let progress =
    target.kind === 'service'
      ? serviceUpdateProgress(target.state, false)
      : appUpdateProgress(appState);
  if (row.checking) progress = 'Checking for a new version…';
  const outcome =
    target.kind === 'service' ? serviceUpdateOutcome(target.state) : undefined;
  const latest =
    target.kind === 'service' ? target.state.latest : target.latest;
  const pending =
    batch.running &&
    (entry?.status === 'updating' || entry?.status === 'queued');
  let action: ReactNode;
  if (pending || progress)
    action = (
      <p role="status" className="flex items-center gap-2 text-xs">
        <Spinner />
        {progress ?? (entry?.status === 'queued' ? 'Queued' : 'Updating…')}
      </p>
    );
  else if (version)
    action = (
      <Button
        size="sm"
        aria-label={`Update ${target.name}`}
        disabled={batch.running}
        onClick={() => run([target])}
      >
        Update
      </Button>
    );
  else {
    let label =
      row.note ?? (latest ? 'Up to date' : 'Latest version unavailable');
    if (trust && target.kind === 'service' && target.state.available)
      label = 'Needs trust';
    if (target.kind === 'service' && !target.state.managed)
      label = 'Managed on that computer';
    action = !row.error && (
      <span className="text-xs text-muted-foreground">{label}</span>
    );
  }
  return (
    <div
      className="flex min-w-0 flex-col gap-2"
      role="group"
      aria-label={`${target.name} update`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {showName && <p className="text-sm font-medium">{target.name}</p>}
          <p className="text-xs text-muted-foreground">
            <span>
              {target.kind === 'mac-app' ? 'Mac app' : 'Porcelain'}{' '}
              {current ?? 'development build'}
            </span>
            {latest && latest !== current && <> → {latest}</>}
          </p>
        </div>
        {action}
      </div>
      {trust && target.kind === 'service' && target.state.available && (
        <Collapsible>
          <CollapsibleTrigger render={<Button size="sm" variant="ghost" />}>
            How to trust this device
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col gap-2 pt-2 text-xs text-muted-foreground">
              <p>{trust.hint}</p>
              {trust.deviceId && (
                <div className="flex min-w-0 items-center gap-2">
                  <code className="break-all">{trust.deviceId}</code>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Copy device ID"
                    onClick={() => copyText(trust.deviceId ?? '', 'device ID')}
                  >
                    <CopyIcon />
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      {row.error && (
        <p role="alert" className="text-xs text-destructive">
          {row.error}
        </p>
      )}
      {entry?.status === 'failed' && (
        <p role="alert" className="text-xs text-destructive">
          {entry.message}
        </p>
      )}
      {!pending && outcome?.kind === 'failed' && entry?.status !== 'failed' && (
        <p role="alert" className="text-xs text-destructive">
          {outcome.reason}
        </p>
      )}
      {entry?.status === 'updated' && (
        <p role="status" className="text-xs text-muted-foreground">
          Updated to {entry.version}.
        </p>
      )}
      {entry?.status === 'updated' &&
        target.kind === 'service' &&
        local?.environmentId === target.id && (
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        )}
      {target.kind === 'service' && !target.state.managed && (
        <p className="text-xs text-muted-foreground">
          This computer runs outside the installed service. Update it with npm,
          then run porcelain service update.
        </p>
      )}
    </div>
  );
}
