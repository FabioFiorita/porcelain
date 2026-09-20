import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { expect, test, vi } from 'vitest';
import { browserTransport } from '../session/live';
import { createPairingLive } from './live';

const environmentId = '7fe18f78-1477-4c19-a42b-cdd42f862151';
const signal = new AbortController().signal;

function transportFor(
  answers: Partial<Record<string, () => Response | Promise<Response>>>,
) {
  return vi.fn<typeof fetch>(async (input) => {
    const answer = answers[String(input)];
    if (!answer) throw new Error(`Unexpected request to ${String(input)}`);
    return answer();
  });
}

test('redeems through the browser transport, so the credential comes back as a cookie', async () => {
  const transport = transportFor({
    '/api/health': () => Response.json({ status: 'ok', environmentId }),
    '/api/pair': () => Response.json({ device: { id: 'device' } }),
    '/api/session': () =>
      Response.json({ environmentId, projects: [], projectHome: '/srv' }),
  });
  await createPairingLive(browserTransport(transport)).redeem({
    code: 'pcp_code',
    environmentId,
    signal,
  });
  // Without this header the server answers with the credential in the body,
  // where script can read it, and every other assertion here still passes.
  for (const [input, init] of transport.mock.calls) {
    const headers = new Headers(init?.headers);
    expect(headers.get('x-porcelain-browser'), String(input)).toBe('1');
    expect(headers.get('authorization'), String(input)).toBeNull();
  }
});

test('checks the installation before sending the code, then redeems it', async () => {
  const transport = transportFor({
    '/api/health': () => Response.json({ status: 'ok', environmentId }),
    '/api/pair': () => Response.json({ device: { id: 'device' } }),
    '/api/session': () =>
      Response.json({ environmentId, projects: [], projectHome: '/srv' }),
  });
  const inventory = await createPairingLive(transport).redeem({
    code: 'pcp_code',
    environmentId,
    signal,
  });
  expect(inventory.environmentId).toBe(environmentId);
  // Order matters: the code must not be sent before the id is confirmed.
  expect(transport.mock.calls.map(([input]) => String(input))).toEqual([
    '/api/health',
    '/api/pair',
    '/api/session',
  ]);
  const [, pair] = transport.mock.calls[1] ?? [];
  expect(JSON.parse(String(pair?.body)).code).toBe('pcp_code');
});

test('refuses a link made for another installation without sending the code', async () => {
  const transport = transportFor({
    '/api/health': () =>
      Response.json({ status: 'ok', environmentId: 'a-different-one' }),
  });
  await expect(
    createPairingLive(transport).redeem({
      code: 'pcp_code',
      environmentId,
      signal,
    }),
  ).rejects.toThrow('different Porcelain installation');
  expect(transport).toHaveBeenCalledTimes(1);
});

test('separates an unreachable server from an unusable link', async () => {
  const offline = createPairingLive(
    vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')),
  );
  // Retryable: the owner starts the server and opens the same link again.
  await expect(
    offline.redeem({ code: 'pcp_code', environmentId, signal }),
  ).rejects.toThrow('Check that the server is running');

  const notPorcelain = createPairingLive(
    transportFor({ '/api/health': () => Response.json({ hello: 'world' }) }),
  );
  await expect(
    notPorcelain.redeem({ code: 'pcp_code', environmentId, signal }),
  ).rejects.toThrow('not a Porcelain server');
});

test('gives one answer for an invalid, used or expired code', async () => {
  for (const status of [400, 404, 409, 410]) {
    const transport = transportFor({
      '/api/health': () => Response.json({ status: 'ok', environmentId }),
      '/api/pair': () => new Response('{}', { status }),
    });
    const failure = await createPairingLive(transport)
      .redeem({ code: 'pcp_code', environmentId, signal })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConnectionError);
    expect((failure as Error).message).toBe(
      'This pairing link is not usable. Ask for a new one.',
    );
  }
});
