import { describe, expect, it } from 'vitest';
import type { CheckRequestOriginInput } from '@porcelain/access/models';
import { requestOriginCheck } from './request-origin-check.ts';

function check(request: Partial<CheckRequestOriginInput>) {
  return requestOriginCheck({
    host: '127.0.0.1:4173',
    origin: undefined,
    method: 'GET',
    scheme: 'http',
    localAddress: '127.0.0.1',
    allowedHosts: [],
    requireSameOrigin: false,
    ...request,
  });
}

describe('requestOriginCheck', () => {
  it('lets a read through a loopback host without an origin', () => {
    expect(check({})).toEqual({ kind: 'allowed' });
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['two colons', 'a:b:c'],
    ['an unclosed bracket', '[::1'],
    ['text after the bracket', '[::1]x'],
    ['a port that is not a number', 'localhost:port'],
    ['a NUL byte', 'local\0host'],
  ])('refuses a request whose Host header is %s', (_, host) => {
    expect(check({ host })).toEqual({
      kind: 'refused',
      refusal: { kind: 'host-malformed' },
    });
  });

  it('refuses a host the server was not told to answer to', () => {
    expect(
      check({ host: 'attacker.example:4173', localAddress: '192.168.1.5' }),
    ).toEqual({
      kind: 'refused',
      refusal: { kind: 'host-not-allowed', hostname: 'attacker.example' },
    });
  });

  it('answers to a configured host and to the address the request reached', () => {
    expect(
      check({ host: 'Laptop.Local.:4173', allowedHosts: ['laptop.local'] }),
    ).toEqual({ kind: 'allowed' });
    expect(
      check({ host: '192.168.1.5:4173', localAddress: '::ffff:192.168.1.5' }),
    ).toEqual({ kind: 'allowed' });
    expect(check({ host: '[::1]:4173' })).toEqual({ kind: 'allowed' });
  });

  it('lets a write without an origin through, as a non-browser client sends it', () => {
    expect(check({ method: 'POST' })).toEqual({ kind: 'allowed' });
  });

  it('requires an origin where same origin is demanded, even for a read', () => {
    expect(check({ requireSameOrigin: true })).toEqual({
      kind: 'refused',
      refusal: { kind: 'origin-required' },
    });
  });

  it('refuses a write from an opaque or malformed origin', () => {
    expect(check({ method: 'POST', origin: 'null' })).toEqual({
      kind: 'refused',
      refusal: { kind: 'origin-opaque' },
    });
    expect(check({ method: 'POST', origin: 'not a url' })).toEqual({
      kind: 'refused',
      refusal: { kind: 'origin-malformed' },
    });
  });

  it.each([
    ['another scheme', 'https://127.0.0.1:4173'],
    ['another host', 'http://elsewhere.example'],
    ['another port', 'http://127.0.0.1:4174'],
  ])('refuses a write from %s', (_, origin) => {
    expect(check({ method: 'PATCH', origin })).toEqual({
      kind: 'refused',
      refusal: { kind: 'cross-origin', origin },
    });
  });

  it('accepts a write from the same origin, written with or without its default port', () => {
    expect(
      check({
        method: 'DELETE',
        host: 'localhost',
        origin: 'http://localhost:80',
      }),
    ).toEqual({ kind: 'allowed' });
    expect(
      check({
        method: 'POST',
        host: '127.0.0.1:4173',
        origin: 'http://127.0.0.1:4173',
      }),
    ).toEqual({ kind: 'allowed' });
  });

  it('checks the origin of a read where same origin is demanded', () => {
    expect(
      check({ requireSameOrigin: true, origin: 'http://elsewhere.example' }),
    ).toEqual({
      kind: 'refused',
      refusal: { kind: 'cross-origin', origin: 'http://elsewhere.example' },
    });
    expect(
      check({ requireSameOrigin: true, origin: 'http://127.0.0.1:4173' }),
    ).toEqual({ kind: 'allowed' });
  });
});
