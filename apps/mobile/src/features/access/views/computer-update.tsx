import { useState } from 'react';
import { useAtom, useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  readServiceUpdate,
  runSettingsUpdates,
  settingsUpdateBatch,
  settingsUpdateTrust,
  settingsUpdateVersion,
  settingsUpdateAvailable,
  type ServiceUpdateTarget,
  type SettingsUpdateEntry,
} from '@porcelain/client/access';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { Box } from '../../../components/ui/box';
import { ButtonSurface } from '../../../components/ui/button-surface';
import { Icon } from '../../../components/ui/icon';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { useServiceUpdates } from '../queries/service-updates';

export function ComputerUpdate({ environmentId }: { environmentId: string }) {
  const { rows } = useServiceUpdates();
  const row = rows.find(
    (entry) => entry.remote.environmentId === environmentId,
  );
  return row ? <ConnectedComputerUpdate row={row} /> : null;
}

function ConnectedComputerUpdate({
  row,
}: {
  row: ReturnType<typeof useServiceUpdates>['rows'][number];
}) {
  const batch = useAtomValue(settingsUpdateBatch);
  const refresh = useAtomRefresh(readServiceUpdate(row.connection));
  const target = row.target;
  const entry = batch.entries.find(
    (candidate) => candidate.id === row.remote.environmentId,
  );
  const inBatch =
    batch.running &&
    entry &&
    (entry.status === 'queued' || entry.status === 'updating');
  return (
    <Box gap={3}>
      {AsyncResult.isInitial(row.result) ? (
        <Loading label="Checking updates…" />
      ) : null}
      {AsyncResult.isFailure(row.result) ? (
        <ErrorState
          message={connectionErrorMessage(Cause.squash(row.result.cause))}
          retry={{ label: 'Check updates again', onPress: refresh }}
        />
      ) : null}
      {target ? (
        <Text variant="caption" tone="muted">
          Porcelain {target.state.version ?? 'Unknown version'}
          {settingsUpdateAvailable(target) && target.state.latest
            ? ` → ${target.state.latest}`
            : ''}
        </Text>
      ) : null}
      {inBatch ? (
        <Text variant="caption" tone="muted">
          {entry.status === 'queued' ? 'Queued' : 'Updating…'}
        </Text>
      ) : null}
      {!inBatch && target ? <ServiceUpdateAction target={target} /> : null}
      {entry && !inBatch ? <UpdateOutcome entry={entry} /> : null}
    </Box>
  );
}

function ServiceUpdateAction({ target }: { target: ServiceUpdateTarget }) {
  const batch = useAtomValue(settingsUpdateBatch);
  const [, run] = useAtom(runSettingsUpdates);
  const trust = settingsUpdateTrust(target);
  const version = settingsUpdateVersion(target);
  if (!target.state.managed)
    return (
      <Text variant="caption" tone="muted">
        This server runs outside the installed service. Update it with npm, then
        run porcelain service update.
      </Text>
    );
  if (trust) return <TrustInstructions target={target} trust={trust} />;
  if (target.state.running) return <Loading label="Updating…" />;
  if (version)
    return (
      <Button
        label={`Update to ${version}`}
        variant="outline"
        disabled={batch.running}
        onPress={() => run([target])}
      />
    );
  return (
    <Text variant="caption" tone="muted">
      {target.state.available ? 'Update unavailable' : 'Up to date'}
    </Text>
  );
}

function TrustInstructions({
  target,
  trust,
}: {
  target: ServiceUpdateTarget;
  trust: NonNullable<ReturnType<typeof settingsUpdateTrust>>;
}) {
  const [expanded, setExpanded] = useState(false);
  const refresh = useAtomRefresh(readServiceUpdate(target.connection));
  return (
    <Box gap={2}>
      <ButtonSurface
        variant="outline"
        onPress={() => setExpanded(!expanded)}
        accessibilityLabel={`${expanded ? 'Hide trust instructions' : 'Needs trust'} for ${target.name}`}
      >
        <Icon name="lock" />
        <Text variant="ui" weight="medium">
          {expanded ? 'Hide trust instructions' : trust.label}
        </Text>
      </ButtonSurface>
      {expanded ? (
        <Box gap={2}>
          <Text variant="ui">This device can’t update {target.name} yet.</Text>
          <Text variant="caption" selectable>
            {trust.hint}
          </Text>
          {trust.deviceId ? (
            <Text
              selectable
              variant="code"
              accessibilityLabel={`Device ID on ${target.name}: ${trust.deviceId}. Touch and hold to copy.`}
            >
              {trust.deviceId}
            </Text>
          ) : null}
          <Text variant="small" tone="muted">
            Touch and hold the device ID to copy. After allowing updates, check
            again.
          </Text>
          <Button
            variant="ghost"
            label="Check updates again"
            onPress={refresh}
          />
        </Box>
      ) : null}
    </Box>
  );
}

function UpdateOutcome({ entry }: { entry: SettingsUpdateEntry }) {
  if (entry.status === 'failed')
    return (
      <Text variant="caption" tone="destructive" accessibilityRole="alert">
        {entry.message}
      </Text>
    );
  let label = 'Updating…';
  if (entry.status === 'queued') label = 'Queued';
  if (entry.status === 'updated') label = `Updated to ${entry.version}`;
  return (
    <Text variant="caption" tone="muted">
      {label}
    </Text>
  );
}
