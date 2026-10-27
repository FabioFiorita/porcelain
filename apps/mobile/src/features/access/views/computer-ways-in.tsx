import { useState, type ReactNode } from 'react';
import { useAtom, useAtomRef, useAtomValue } from '@effect/atom-react';
import { Platform } from 'react-native';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  readRemoteAccess,
  setRemoteAccess,
  type EnvironmentConnection,
} from '@porcelain/client/access';
import {
  ANDROID_EMULATOR_HOST,
  connectionErrorMessage,
  hostnameForm,
  LOCAL_NETWORK_WARNING,
  localNetworkNote,
  networkName,
  protectedRouteNote,
  remoteRouteDescriptions,
  remoteRouteTitles,
  routeFailure,
  routeStatusLabel,
  waysInRefusal,
  type HostnameFormInput,
  type RemoteAccess,
  type RemoteAccessChange,
  type RemoteRouteName,
} from '@porcelain/client/access/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { remoteConnectionState } from '../../../shared/application/store';
import { Badge } from '../../../components/ui/badge';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Loading } from '../../../components/ui/loading';
import { Switch } from '../../../components/ui/switch';
import { Text } from '../../../components/ui/text';

export function ComputerWaysIn({ environmentId }: { environmentId: string }) {
  const connections = useAtomRef(remoteConnectionState);
  const connection = connections.find(
    (entry) => entry.remote.environmentId === environmentId,
  )?.connection;
  return (
    <Box gap={3}>
      <Text variant="subheading" tone="muted">
        Ways in
      </Text>
      {connection ? (
        <ConnectedWaysIn connection={connection} />
      ) : (
        <Text variant="caption" tone="muted">
          Connect to this computer to see its ways in.
        </Text>
      )}
    </Box>
  );
}

function ConnectedWaysIn({
  connection,
}: {
  connection: EnvironmentConnection;
}) {
  const result = useAtomValue(readRemoteAccess(connection));
  const answer = Option.getOrUndefined(AsyncResult.value(result));
  if (answer === null)
    return (
      <Text variant="caption" tone="muted">
        {waysInRefusal(
          connection.address,
          Platform.OS === 'android' ? [ANDROID_EMULATOR_HOST] : [],
        )}
      </Text>
    );
  if (AsyncResult.isFailure(result))
    return (
      <Text accessibilityRole="alert" variant="ui" tone="destructive">
        {connectionErrorMessage(Cause.squash(result.cause))}
      </Text>
    );
  if (!answer) return <Loading label="Reading ways in…" />;
  return <WaysInEditor connection={connection} remote={answer} />;
}

function WaysInEditor({
  connection,
  remote,
}: {
  connection: RuntimeConnection;
  remote: RemoteAccess;
}) {
  const [change, save] = useAtom(setRemoteAccess(connection));
  const waiting = change.waiting;
  const setRemote = (edit: RemoteAccessChange) =>
    save({ expected: remote.editing.fingerprint, change: edit });
  return (
    <Box gap={3}>
      <RouteCard
        name="lan"
        remote={remote}
        disabled={
          waiting ||
          (!remote.routes.lan.enabled && remote.localNetwork === undefined)
        }
        onChange={(lan) => setRemote({ lan })}
      >
        <Box gap={2}>
          {remote.routes.lan.enabled &&
          remote.routes.lan.status.kind === 'paused' &&
          remote.localNetwork ? (
            <Button
              variant="outline"
              label={`Turn on for ${networkName(remote.localNetwork)}`}
              disabled={waiting}
              onPress={() => setRemote({ lan: true })}
            />
          ) : null}
          <Text variant="caption" tone="muted">
            {localNetworkNote(remote)}
          </Text>
          <Text variant="caption" tone="muted">
            <Text variant="caption" weight="medium">
              Not encrypted.
            </Text>{' '}
            {LOCAL_NETWORK_WARNING}
          </Text>
        </Box>
      </RouteCard>
      <RouteCard
        name="tailnet"
        remote={remote}
        disabled={waiting || remote.tailnetHostname === undefined}
        onChange={(tailnet) => setRemote({ tailnet })}
      >
        <HostnameForm
          route="tailnet"
          remote={remote}
          disabled={waiting}
          onChange={setRemote}
        />
      </RouteCard>
      <RouteCard
        name="cloudflare"
        remote={remote}
        disabled={waiting || remote.cloudflareHostname === undefined}
        onChange={(cloudflare) => setRemote({ cloudflare })}
      >
        <HostnameForm
          route="cloudflare"
          remote={remote}
          disabled={waiting}
          onChange={setRemote}
        />
      </RouteCard>
      {AsyncResult.isFailure(change) ? (
        <Text accessibilityRole="alert" variant="ui" tone="destructive">
          {connectionErrorMessage(Cause.squash(change.cause))}
        </Text>
      ) : null}
    </Box>
  );
}

function HostnameForm(input: HostnameFormInput) {
  const { disabled, onChange } = input;
  const [typed, setTyped] = useState<string | null>(null);
  const form = hostnameForm(input.remote, input.route, typed);
  return (
    <Box gap={2}>
      <Input
        accessibilityLabel={form.label}
        placeholder={form.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        value={form.value}
        disabled={disabled}
        onChangeText={setTyped}
      />
      <Button
        variant="outline"
        label={form.saveLabel}
        disabled={disabled || !form.canSave}
        onPress={() => {
          onChange(form.save);
          setTyped(null);
        }}
      />
      {form.failed ? (
        <Button
          variant="outline"
          label="Check again"
          disabled={disabled}
          onPress={() => onChange(form.check)}
        />
      ) : null}
    </Box>
  );
}

function RouteCard({
  name,
  remote,
  disabled,
  onChange,
  children,
}: {
  name: RemoteRouteName;
  remote: RemoteAccess;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
  children: ReactNode;
}) {
  const route = remote.routes[name];
  const title = remoteRouteTitles[name];
  const connectedThrough = remote.editing.protectedRoute === name;
  const label = routeStatusLabel(name, route);
  return (
    <Card gap={2} padding={4}>
      <Box className="flex-row items-center justify-between" gap={3}>
        <Box className="min-w-0 flex-1" gap={1}>
          <Text variant="ui" weight="medium">
            {title}
          </Text>
          <Text variant="caption" tone="muted">
            {remoteRouteDescriptions[name]}
          </Text>
        </Box>
        <Switch
          label={title}
          checked={route.enabled}
          disabled={disabled || connectedThrough}
          onCheckedChange={onChange}
        />
      </Box>
      {label ? (
        <Badge
          label={label}
          variant={route.status.kind === 'failed' ? 'destructive' : 'outline'}
        />
      ) : null}
      {route.status.kind === 'failed' ? (
        <Text variant="caption" tone="muted">
          {routeFailure(name, route.status.reason)}
        </Text>
      ) : null}
      {route.status.kind === 'on'
        ? route.status.urls.map((url) => (
            <Text key={url} variant="code" tone="muted" selectable>
              {url}
            </Text>
          ))
        : null}
      {connectedThrough ? (
        <Text variant="caption" tone="muted">
          {protectedRouteNote(name)}
        </Text>
      ) : (
        children
      )}
    </Card>
  );
}
