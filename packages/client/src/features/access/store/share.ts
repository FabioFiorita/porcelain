import type {
  ReadRemoteAccessResponse,
  ReadServiceUpdateResponse,
} from '@porcelain/contracts/access';
import { Context, Effect, Layer, Option, Ref } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

export class AccessSnapshots extends Context.Service<
  AccessSnapshots,
  {
    readonly remote: Ref.Ref<Option.Option<ReadRemoteAccessResponse | null>>;
    readonly update: Ref.Ref<Option.Option<ReadServiceUpdateResponse>>;
  }
>()('@porcelain/client/AccessSnapshots') {
  static readonly layer = Layer.effect(
    AccessSnapshots,
    Effect.gen(function* () {
      return {
        remote: yield* Ref.make(Option.none<ReadRemoteAccessResponse | null>()),
        update: yield* Ref.make(Option.none<ReadServiceUpdateResponse>()),
      };
    }),
  );
}
export const accessRuntime = Atom.family((connection: RuntimeConnection) =>
  connection.atoms((get) =>
    Layer.provideMerge(
      AccessSnapshots.layer,
      get(clientRuntime(connection).layer),
    ),
  ),
);
