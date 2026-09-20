import { expect, it } from 'vitest';
import { ForbiddenOriginError } from '../errors/forbidden-origin-error.ts';
import { checkRequestOrigin } from './request-origin.ts';

type Call = {
  method?: string;
  host?: string | undefined;
  origin?: string | undefined;
  protocol?: string;
  localAddress?: string | undefined;
  forwarded?: Record<string, string>;
};

function check(policy: string[], call: Call) {
  const headers: Record<string, string | undefined> = {
    ...(call.host === undefined ? {} : { host: call.host }),
    ...(call.origin === undefined ? {} : { origin: call.origin }),
    ...call.forwarded,
  };
  const request = {
    method: call.method ?? 'GET',
    protocol: call.protocol ?? 'http',
    headers,
    socket: { localAddress: call.localAddress ?? '127.0.0.1' },
  };
  return checkRequestOrigin({ allowedHosts: policy })(
    request as unknown as Parameters<ReturnType<typeof checkRequestOrigin>>[0],
  );
}

const allowed = (policy: string[], call: Call) =>
  expect(check(policy, call)).resolves.toBeUndefined();
const refused = (policy: string[], call: Call) =>
  expect(check(policy, call)).rejects.toBeInstanceOf(ForbiddenOriginError);

it('answers to loopback, its own address and names given on the command line', async () => {
  await allowed([], { host: 'localhost:3000' });
  await allowed([], { host: '127.0.0.1:3000' });
  await allowed([], { host: '127.0.0.5' });
  await allowed([], { host: '[::1]:3000' });
  // One address, many spellings.
  await allowed([], { host: '[0:0:0:0:0:0:0:1]:3000' });
  await allowed([], { host: 'LocalHost.' });

  // A wildcard bind still answers on the address the connection arrived on.
  await allowed([], { host: '192.168.1.5:3000', localAddress: '192.168.1.5' });
  await allowed([], {
    host: '[fd7a:115c:a1e0::1]',
    localAddress: 'fd7a:115c:a1e0:0:0:0:0:1',
  });
  await allowed([], {
    host: '192.168.1.5',
    localAddress: '::ffff:192.168.1.5',
  });
  await allowed(['porcelain.tail1234.ts.net'], {
    host: 'porcelain.tail1234.ts.net:3000',
    localAddress: '100.64.0.1',
  });
});

it('refuses a host it was never told to answer to', async () => {
  await refused([], { host: 'attacker.example' });
  await refused([], { host: '192.168.1.5:3000', localAddress: '10.0.0.2' });
  await refused([], { host: undefined });
  await refused([], { host: '' });
  await refused([], { host: 'evil.example:notaport' });
  // A bare IPv6 literal is only legal in brackets; unbracketed is malformed.
  await refused([], { host: '::1:3000' });
  await refused(['desk.local'], { host: 'other.local' });
});

it('never lets a forwarded header decide the answer', async () => {
  const forwarded = {
    'x-forwarded-host': 'localhost',
    'x-forwarded-for': '127.0.0.1',
    'x-forwarded-proto': 'https',
    forwarded: 'host=localhost;proto=https',
  };
  await refused([], { host: 'attacker.example', forwarded });
  await refused([], {
    method: 'POST',
    host: 'localhost:3000',
    origin: 'https://attacker.example',
    forwarded,
  });
});

it('accepts writes with no Origin and only from its own origin', async () => {
  // Non-browser clients send no Origin at all.
  await allowed([], { method: 'POST', host: 'localhost:3000' });
  await allowed([], {
    method: 'POST',
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
  });
  // Default ports are the same origin written two ways.
  await allowed([], {
    method: 'POST',
    host: 'localhost',
    origin: 'http://localhost:80',
  });
  await allowed([], {
    method: 'POST',
    host: 'localhost:80',
    origin: 'http://localhost',
  });
  await allowed([], {
    method: 'POST',
    protocol: 'https',
    host: 'localhost',
    origin: 'https://localhost:443',
  });
  await allowed([], {
    method: 'POST',
    host: '[::1]:3000',
    origin: 'http://[0:0:0:0:0:0:0:1]:3000',
  });

  await refused([], {
    method: 'POST',
    host: 'localhost:3000',
    origin: 'null',
  });
  await refused([], {
    method: 'POST',
    host: 'localhost:3000',
    origin: 'http://attacker.example',
  });
  // A different port or scheme is a different origin.
  await refused([], {
    method: 'POST',
    host: 'localhost:3000',
    origin: 'http://localhost:5173',
  });
  await refused([], {
    method: 'POST',
    host: 'localhost:3000',
    origin: 'https://localhost:3000',
  });
  await refused([], {
    method: 'POST',
    host: 'localhost:3000',
    origin: 'not a url',
  });
});

it('leaves reads alone whatever origin they claim', async () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS'])
    await allowed([], {
      method,
      host: 'localhost:3000',
      origin: 'http://attacker.example',
    });
});
