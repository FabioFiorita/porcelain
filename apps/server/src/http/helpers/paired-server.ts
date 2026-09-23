import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';

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

const pairingOrigin = 'http://127.0.0.1:3000';

export const pairingReach = () => ({
  port: 3000,
  policy: { allowedHosts: [], localAddresses: ['127.0.0.1'] },
});

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
