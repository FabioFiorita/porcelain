import { Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import type {
  RemoteAccessSettings,
  RemoteRoutes,
  RouteState,
} from '@porcelain/access/models';
import {
  RemoteAccessStore,
  RouteStateStore,
  RuntimeStatusReader,
} from '@porcelain/access/ports';
import { ReviewLinkSource } from '../../ports/review-link-source.ts';
import { ReviewLinkOptions } from '../../ports/review-link-options.ts';
import { remoteReviewLinkSourceLayer } from './remote-review-link-source.ts';

const local = 'http://127.0.0.1:5090';
const lan = 'http://192.168.1.2:5090';
const cloudflare = 'https://review.example';
const tailnet = 'https://machine.ts.net:8443';
const off: RouteState = { kind: 'off' };
const settings: RemoteAccessSettings = {
  lan: false,
  tailnet: false,
  cloudflare: false,
};
const routes: RemoteRoutes = {
  states: { lan: off, tailnet: off, cloudflare: off },
  origins: [],
};

function source(
  access: RemoteAccessSettings,
  current: RemoteRoutes,
  address = local,
) {
  return remoteReviewLinkSourceLayer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(RemoteAccessStore, {
          read: () => Effect.succeed(access),
          save: () => Effect.void,
        }),
        Layer.succeed(RouteStateStore, { read: () => current, save: () => {} }),
        Layer.succeed(RuntimeStatusReader, {
          current: () => ({ address, dataDirectory: '/disposable', pid: 1 }),
        }),
        Layer.succeed(ReviewLinkOptions, {
          hubOrigin: 'https://porcelain.fabiofiorita.com',
        }),
      ),
    ),
  );
}

it.each([
  ['local only', settings, routes, local, [local]],
  [
    'LAN off with a stale on state',
    settings,
    {
      ...routes,
      states: { ...routes.states, lan: { kind: 'on', urls: [lan] } },
    },
    local,
    [local],
  ],
  [
    'LAN on',
    { ...settings, lan: true },
    {
      ...routes,
      states: { ...routes.states, lan: { kind: 'on', urls: [lan] } },
    },
    local,
    [lan, local],
  ],
  [
    'Cloudflare before Tailscale before LAN',
    { lan: true, tailnet: true, cloudflare: true },
    {
      ...routes,
      states: {
        lan: { kind: 'on', urls: [lan] },
        tailnet: { kind: 'on', urls: [tailnet] },
        cloudflare: { kind: 'on', urls: [cloudflare] },
      },
    },
    local,
    [cloudflare, tailnet, lan, local],
  ],
  [
    'IPv6 listener',
    settings,
    routes,
    'http://[::1]:5090',
    ['http://[::1]:5090'],
  ],
  [
    'uses the reachable HTTPS origin instead of the internal Tailscale target port',
    { ...settings, tailnet: true, tailnetPort: 5099 },
    {
      ...routes,
      states: {
        ...routes.states,
        tailnet: { kind: 'on', urls: ['https://machine.ts.net'] },
      },
    },
    local,
    ['https://machine.ts.net', local],
  ],
  ['no listener', settings, routes, '', []],
  [
    'enabled but empty routes',
    { lan: true, tailnet: true, cloudflare: true },
    {
      ...routes,
      states: {
        lan: { kind: 'on', urls: [] },
        tailnet: { kind: 'on', urls: [] },
        cloudflare: { kind: 'on', urls: [] },
      },
    },
    '',
    [],
  ],
] satisfies readonly (readonly [
  string,
  RemoteAccessSettings,
  RemoteRoutes,
  string,
  readonly string[],
])[])(
  'uses only bound enabled origins: %s',
  (_, access, current, address, expected) => {
    const result = Effect.runSync(
      Effect.flatMap(ReviewLinkSource, (reader) => reader.read()).pipe(
        Effect.provide(source(access, current, address)),
      ),
    );
    expect(result).toEqual({
      hubOrigin: 'https://porcelain.fabiofiorita.com',
      origins: expected,
    });
  },
);

const unavailable: readonly RouteState[] = [
  off,
  { kind: 'starting' },
  { kind: 'paused' },
  ...(
    [
      'address-in-use',
      'address-unavailable',
      'unreachable',
      'other-server',
    ] as const
  ).map((reason) => ({ kind: 'failed' as const, reason })),
];
const routeKeys = ['lan', 'tailnet', 'cloudflare'] as const;
it.each(
  routeKeys.flatMap((key) =>
    unavailable.map(
      (state) =>
        [
          key,
          state.kind === 'failed' ? state.reason : state.kind,
          state,
        ] as const,
    ),
  ),
)('skips the enabled %s route when its state is %s', (key, _, state) => {
  const result = Effect.runSync(
    Effect.flatMap(ReviewLinkSource, (reader) => reader.read()).pipe(
      Effect.provide(
        source(
          { ...settings, [key]: true },
          { ...routes, states: { ...routes.states, [key]: state } },
        ),
      ),
    ),
  );
  expect(result.origins).toEqual([local]);
});
it.each(routeKeys)(
  'skips the disabled %s route with a stale on state',
  (key) => {
    const result = Effect.runSync(
      Effect.flatMap(ReviewLinkSource, (reader) => reader.read()).pipe(
        Effect.provide(
          source(settings, {
            ...routes,
            states: {
              ...routes.states,
              [key]: { kind: 'on', urls: ['https://stale.example'] },
            },
          }),
        ),
      ),
    );
    expect(result.origins).toEqual([local]);
  },
);

it('rereads route status and enabled settings after a route is revoked or recovers', () => {
  const current = { ...routes, states: { ...routes.states } };
  const access = { ...settings, cloudflare: true };
  const results = Effect.runSync(
    Effect.gen(function* () {
      const reader = yield* ReviewLinkSource;
      const first = yield* reader.read();
      current.states.cloudflare = { kind: 'on', urls: [cloudflare] };
      const recovered = yield* reader.read();
      access.cloudflare = false;
      const revoked = yield* reader.read();
      return [first.origins, recovered.origins, revoked.origins];
    }).pipe(Effect.provide(source(access, current))),
  );
  expect(results).toEqual([[local], [cloudflare, local], [local]]);
});
