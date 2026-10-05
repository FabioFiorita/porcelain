import { Effect, Layer, Schema } from 'effect';
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from 'effect/http-api';
import { expect, it } from 'vitest';
import { openHttpApplication } from '@porcelain/server/kit/http';
import { requestBody, requestBodyLimit } from './request-body.ts';

class PayloadApi extends HttpApi.make('payload').add(
  HttpApiGroup.make('payload').add(
    HttpApiEndpoint.post('save', '/payload', {
      payload: Schema.Struct({ value: Schema.String }),
      success: Schema.Struct({ saved: Schema.Boolean }),
    }),
  ),
) {}

async function fixture() {
  let calls = 0;
  const handlers = HttpApiBuilder.group(PayloadApi, 'payload', (handlers) =>
    handlers.handle('save', () =>
      Effect.sync(() => {
        calls += 1;
        return { saved: true };
      }),
    ),
  );
  const app = HttpApiBuilder.layer(PayloadApi).pipe(
    Layer.provide(handlers),
    Layer.provide(requestBody.layer),
    Layer.provide(
      requestBodyLimit(PayloadApi.groups.payload.endpoints.save, 32),
    ),
  );
  const http = await openHttpApplication(app, { kind: 'owner' });
  return { ...http, calls: () => calls };
}

it('uses the endpoint byte limit and refuses an oversized declared body before the operation', async () => {
  const http = await fixture();
  try {
    const accepted = await http.send({
      method: 'POST',
      path: '/payload',
      body: { value: 'small' },
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ saved: true });
    const refused = await http.send({
      method: 'POST',
      path: '/payload',
      body: { value: 'x'.repeat(32) },
    });
    expect(refused.status).toBe(413);
    expect(await refused.json()).toEqual({
      statusCode: 413,
      error: 'Payload Too Large',
      message: 'Request body is too large',
    });
    expect(http.calls()).toBe(1);
  } finally {
    await http.close();
  }
});

it('refuses an oversized chunked body with a response before closing the connection', async () => {
  const http = await fixture();
  try {
    const refused = await http.sendChunks('/payload', [
      '{"value":"',
      'x'.repeat(32),
      '"}',
    ]);
    expect(refused.status).toBe(413);
    expect(refused.body).toEqual({
      statusCode: 413,
      error: 'Payload Too Large',
      message: 'Request body is too large',
    });
    expect(http.calls()).toBe(0);
  } finally {
    await http.close();
  }
});
