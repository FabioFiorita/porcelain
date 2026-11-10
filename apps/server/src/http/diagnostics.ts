import { channel } from 'node:diagnostics_channel';
import { Effect, Layer } from 'effect';
import { HttpRouter } from 'effect/http';
import { RequestContext } from './request-context.ts';

const events = channel('porcelain.http');
export function httpEvent(event: Record<string, unknown>) {
  events.publish(event);
}

export const handlerAudit = HttpRouter.middleware((app) =>
  Effect.flatMap(Effect.serviceOption(RequestContext), (context) => {
    if (context._tag === 'Some')
      httpEvent({
        event: 'handled',
        owner: context.value.principal?.kind === 'owner',
        id: context.value.requestId,
      });
    return app;
  }),
);

export function auditedRouter(owner: boolean) {
  return Layer.effect(
    HttpRouter.HttpRouter,
    Effect.map(HttpRouter.make, (router) => ({
      ...router,
      addAll: <
        const Routes extends readonly HttpRouter.Route<unknown, unknown>[],
      >(
        routes: Routes,
      ) => {
        for (const route of routes)
          httpEvent({
            event: 'registered',
            owner,
            method: route.method,
            route: route.path,
          });
        return router.addAll(routes);
      },
      add: <E, R>(...args: Parameters<typeof HttpRouter.route<E, R>>) => {
        httpEvent({
          event: 'registered',
          owner,
          method: args[0],
          route: args[1],
        });
        return router.addAll([HttpRouter.route(...args)]);
      },
    })),
  );
}
