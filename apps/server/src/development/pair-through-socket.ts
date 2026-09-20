import { request as httpRequest } from 'node:http';

/**
 * Pair one device through the owner socket and return its credential.
 *
 * Development and tests need access without a shared secret, and a pairing
 * grant is single use — so every caller that wants access mints its own rather
 * than passing one around. Reaching the socket is the authority, exactly as it
 * is for the owner at a terminal.
 */
export async function pairThroughSocket(
  socketPath: string,
  address: string,
  label: string,
): Promise<string> {
  const issued = await overSocket(socketPath, '/pairings', {
    labels: [label],
    addresses: [new URL(address).origin],
  });
  const code = (issued as { grants: { code: string }[] }).grants[0]?.code;
  if (!code) throw new Error('The owner socket issued no pairing link');
  const redeemed = await fetch(`${address}/api/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, platform: 'Development' }),
  });
  if (!redeemed.ok) throw new Error('The pairing link was refused');
  const { credential } = (await redeemed.json()) as { credential?: string };
  if (!credential) throw new Error('Pairing returned no credential');
  return credential;
}

/** Call the owner socket, which no network client can reach. */
export function overSocket(
  socketPath: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const call = httpRequest(
      {
        socketPath,
        path,
        method: payload === undefined ? 'GET' : 'POST',
        agent: false,
        headers:
          payload === undefined
            ? {}
            : {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
              },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (response.statusCode !== 200) {
            reject(new Error(`The owner socket answered ${text}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      },
    );
    call.on('error', reject);
    if (payload !== undefined) call.write(payload);
    call.end();
  });
}
