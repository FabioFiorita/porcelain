import { PorcelainClientApi } from '@porcelain/contracts/shared';
import { Context, type Effect, Layer } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { Atom } from 'effect/reactivity';
import { transportLayer } from './effect-client.ts';
import type { Transport } from './transport.ts';

const makeBootstrapClient = HttpApiClient.make(PorcelainClientApi);

export class BootstrapClient extends Context.Service<
  BootstrapClient,
  Effect.Success<typeof makeBootstrapClient>
>()('@porcelain/client/BootstrapClient') {
  static readonly layer = Atom.family((transport: Transport) =>
    Layer.provide(
      Layer.effect(BootstrapClient, makeBootstrapClient),
      transportLayer(transport),
    ),
  );
}

export const bootstrapRuntime = Atom.family((transport: Transport) =>
  Atom.runtime(BootstrapClient.layer(transport)),
);
