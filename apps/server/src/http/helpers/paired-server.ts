import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';

/**
 * Pair one device against a server built for a test, and return the header it
 * authenticates with.
 *
 * There is no shared secret to hand a test any more, so a test acquires access
 * the way a device does: a grant issued inside the application, redeemed over
 * the same public route a browser uses. Going through the real route is the
 * point — a helper that reached into the store would stop proving that the
 * pairing path works.
 */
export async function pairDevice(
  server: FastifyInstance,
  application: Application,
  label = 'Fixture device',
): Promise<{ authorization: string }> {
  const [issued] = await application.issuePairing([label], [pairingOrigin]);
  if (!issued) throw new Error('Expected a pairing grant');
  const redeemed = await server.inject({
    method: 'POST',
    url: '/api/pair',
    headers: { 'content-type': 'application/json' },
    payload: { code: issued.code, platform: 'Fixture' },
  });
  if (redeemed.statusCode !== 200)
    throw new Error(`Pairing failed: ${redeemed.body}`);
  const { credential } = redeemed.json() as { credential: string };
  return { authorization: `Bearer ${credential}` };
}

/**
 * Injected servers never bind, so the origin a link may name is stated rather
 * than discovered. Tests pass this as `pairingReach`.
 */
const pairingOrigin = 'http://127.0.0.1:3000';

export const pairingReach = () => ({
  port: 3000,
  policy: { allowedHosts: [], localAddresses: ['127.0.0.1'] },
});

/**
 * Pair one device the way a browser does: the credential comes back as an
 * HttpOnly cookie instead of in the body, and the caller gets the cookie
 * header to send with later requests.
 */
export async function pairBrowser(
  server: FastifyInstance,
  application: Application,
  label = 'Fixture browser',
): Promise<{ cookie: string; setCookie: string }> {
  const [issued] = await application.issuePairing([label], [pairingOrigin]);
  if (!issued) throw new Error('Expected a pairing grant');
  const redeemed = await server.inject({
    method: 'POST',
    url: '/api/pair',
    headers: { 'content-type': 'application/json', 'x-porcelain-browser': '1' },
    payload: { code: issued.code, platform: 'Fixture' },
  });
  if (redeemed.statusCode !== 200)
    throw new Error(`Pairing failed: ${redeemed.body}`);
  if ('credential' in (redeemed.json() as object))
    throw new Error('A browser must never receive the credential in the body');
  const header = redeemed.headers['set-cookie'];
  const setCookie = Array.isArray(header) ? header[0] : header;
  if (!setCookie) throw new Error('Expected a device cookie');
  return { cookie: setCookie.split(';', 1)[0] ?? '', setCookie };
}
