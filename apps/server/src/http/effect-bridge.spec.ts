import Fastify from 'fastify';
import { Effect, Layer, Schema } from 'effect';
import { HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import {
  PairedRequest,
  RequestCaller,
  porcelainApi,
} from '@porcelain/contracts/shared';

import { expect, it } from 'vitest';
import { effectRoutes, mountEffectRoutes } from './effect-bridge.ts';

class CallerApi extends porcelainApi.add(
  HttpApiGroup.make('caller')
    .add(
      HttpApiEndpoint.post('readCaller', '/api/caller', {
        payload: Schema.Struct({ value: Schema.String }),
        success: Schema.Struct({ caller: Schema.String, value: Schema.String }),
      }),
    )
    .middleware(PairedRequest),
) {}

async function fixture(authenticated: boolean) {
  let called = 0;
  const handlers = HttpApiBuilder.group(CallerApi, 'caller', (handlers) =>
    handlers.handle('readCaller', ({ payload }) =>
      Effect.map(RequestCaller, (caller) => {
        called += 1;
        return { caller: caller.kind, value: payload.value };
      }),
    ),
  );
  const routes = effectRoutes(
    CallerApi,
    HttpApiBuilder.layer(CallerApi).pipe(Layer.provide(handlers)),
    { readCaller: 32 },
  );
  const server = Fastify();
  server.addHook('onRequest', async (request) => {
    Object.defineProperty(request, 'principal', {
      value: authenticated ? { kind: 'owner' } : undefined,
    });
    Object.defineProperty(request, 'disconnected', {
      value: new AbortController().signal,
    });
  });
  await server.register(mountEffectRoutes, { prefix: '/api', routes });
  return {
    server,
    called: () => called,
    close: async () => {
      await server.close();
      await routes.dispose();
    },
  };
}

it('provides the request caller to generated handlers', async () => {
  const test = await fixture(true);
  try {
    const response = await test.server.inject({
      method: 'POST',
      url: '/api/caller',
      payload: { value: 'Hello' },
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({ caller: 'owner', value: 'Hello' });
    expect(test.called()).toBe(1);
  } finally {
    await test.close();
  }
});

it('rejects a payload-supplied caller before running the handler', async () => {
  const test = await fixture(true);
  try {
    const small = await test.server.inject({
      method: 'POST',
      url: '/api/caller',
      payload: { value: 'x', writer: 1 },
    });
    expect(small.statusCode).toBe(400);
    expect(test.called()).toBe(0);
  } finally {
    await test.close();
  }
});

it('refuses a caller-dependent handler when the transport supplies no principal', async () => {
  const test = await fixture(false);
  try {
    const response = await test.server.inject({
      method: 'POST',
      url: '/api/caller',
      payload: { value: 'Hello' },
    });
    expect(response.statusCode).toBe(500);
    expect(test.called()).toBe(0);
  } finally {
    await test.close();
  }
});

it('enforces the endpoint body limit before decoding the payload', async () => {
  const test = await fixture(true);
  try {
    const response = await test.server.inject({
      method: 'POST',
      url: '/api/caller',
      payload: { value: 'x'.repeat(40) },
    });
    expect(response.statusCode, response.body).toBe(413);
    expect(test.called()).toBe(0);
  } finally {
    await test.close();
  }
});
