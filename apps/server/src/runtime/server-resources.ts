import { Context, Effect, Exit, Layer, Scope } from 'effect';
import type { OpenedServer } from '../ports/opened-server.ts';

export class ServerComponents extends Context.Service<
  ServerComponents,
  OpenedServer
>()('@porcelain/server/ServerComponents') {}

export const openServerResources = Effect.fn('openServerResources')(function* (
  resources: Layer.Layer<ServerComponents>,
) {
  const applicationScope = yield* Scope.Scope;
  const scope = yield* Scope.fork(applicationScope, 'sequential');
  const context = yield* Layer.build(resources).pipe(
    Scope.provide(scope),
    Effect.onExit((exit) =>
      Exit.isFailure(exit) ? Scope.close(scope, exit) : Effect.void,
    ),
  );
  const components = Context.get(context, ServerComponents);
  const close = yield* Effect.cached(Scope.close(scope, Exit.void));
  return { ...components, close: () => close };
});
