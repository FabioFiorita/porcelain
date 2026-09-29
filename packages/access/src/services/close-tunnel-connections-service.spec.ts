import { describe, expect, it } from 'vitest';
import type {
  RemoteAccessSettings,
  RouteState,
} from '@porcelain/access/models';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';
import { InMemoryRouteStateStore } from '../../spec/fakes/in-memory-route-state-store.ts';
import { RecordingTunnelConnectionStore } from '../../spec/fakes/recording-tunnel-connection-store.ts';
import { CloseTunnelConnectionsService } from './close-tunnel-connections-service.ts';

const tunnelHost = 'porcelain.example.com';

function answeredAfter(
  change: Partial<RemoteAccessSettings>,
  cloudflare: RouteState = { kind: 'on', urls: [] },
) {
  const settings = new InMemoryRemoteAccessStore();
  settings.save({
    lan: false,
    tailnet: false,
    cloudflare: true,
    cloudflareHostname: tunnelHost,
    ...change,
  });
  const routes = new InMemoryRouteStateStore();
  routes.save({
    states: { lan: { kind: 'off' }, tailnet: { kind: 'off' }, cloudflare },
    origins: [],
  });
  const connections = new RecordingTunnelConnectionStore();
  new CloseTunnelConnectionsService(settings, routes, connections).execute();
  return connections.retained();
}

describe('CloseTunnelConnectionsService', () => {
  it('keeps the connections that came through the tunnel hostname while Cloudflare is on', () => {
    expect(answeredAfter({})).toEqual([[tunnelHost]]);
  });

  it('closes every tunnel connection once Cloudflare is turned off', () => {
    expect(answeredAfter({ cloudflare: false })).toEqual([[]]);
  });

  it('closes the connections of the old hostname once the tunnel serves another', () => {
    expect(
      answeredAfter(
        { cloudflareHostname: 'porcelain.example.org' },
        {
          kind: 'starting',
        },
      ),
    ).toEqual([['porcelain.example.org']]);
  });

  it('closes the tunnel connections once another server answers at the hostname', () => {
    expect(
      answeredAfter({}, { kind: 'failed', reason: 'other-server' }),
    ).toEqual([[]]);
  });

  it('keeps them while nothing answers at the hostname yet', () => {
    expect(
      answeredAfter({}, { kind: 'failed', reason: 'unreachable' }),
    ).toEqual([[tunnelHost]]);
  });
});
