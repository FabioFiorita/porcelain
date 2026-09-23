import { describe, expect, it } from 'vitest';
import { CheckRequestOriginService } from './check-request-origin-service.ts';

const service = new CheckRequestOriginService();

function check(
  request: Partial<Parameters<CheckRequestOriginService['execute']>[0]>,
) {
  return service.execute({
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

describe('CheckRequestOriginService', () => {
  it('lets a read through a loopback host without an origin', () => {
    expect(check({})).toEqual({ allowed: true });
  });

  it('refuses a request whose Host header is missing, empty or malformed', () => {
    for (const host of [
      undefined,
      '',
      'a:b:c',
      '[::1',
      '[::1]x',
      'localhost:port',
      'local\0host',
    ])
      expect(check({ host })).toEqual({
        allowed: false,
        reason: 'The Host header is missing or malformed',
      });
  });

  it('refuses a host the server was not told to answer to', () => {
    expect(
      check({ host: 'attacker.example:4173', localAddress: '192.168.1.5' }),
    ).toEqual({
      allowed: false,
      reason: 'This server does not answer to the host attacker.example',
    });
  });

  it('answers to a configured host and to the address the request reached', () => {
    expect(
      check({ host: 'Laptop.Local.:4173', allowedHosts: ['laptop.local'] }),
    ).toEqual({ allowed: true });
    expect(
      check({ host: '192.168.1.5:4173', localAddress: '::ffff:192.168.1.5' }),
    ).toEqual({ allowed: true });
    expect(check({ host: '[::1]:4173' })).toEqual({ allowed: true });
  });

  it('lets a write without an origin through, as a non-browser client sends it', () => {
    expect(check({ method: 'POST' })).toEqual({ allowed: true });
  });

  it('requires an origin where same origin is demanded, even for a read', () => {
    expect(check({ requireSameOrigin: true })).toEqual({
      allowed: false,
      reason: 'The Origin header is required',
    });
  });

  it('refuses a write from an opaque or malformed origin', () => {
    expect(check({ method: 'POST', origin: 'null' })).toEqual({
      allowed: false,
      reason: 'An opaque origin cannot write',
    });
    expect(check({ method: 'POST', origin: 'not a url' })).toEqual({
      allowed: false,
      reason: 'The Origin header is malformed',
    });
  });

  it('refuses a write from another scheme, host or port', () => {
    for (const origin of [
      'https://127.0.0.1:4173',
      'http://elsewhere.example',
      'http://127.0.0.1:4174',
    ])
      expect(check({ method: 'PATCH', origin })).toEqual({
        allowed: false,
        reason: `The origin ${origin} cannot write here`,
      });
  });

  it('accepts a write from the same origin, written with or without its default port', () => {
    expect(
      check({
        method: 'DELETE',
        host: 'localhost',
        origin: 'http://localhost:80',
      }),
    ).toEqual({ allowed: true });
    expect(
      check({
        method: 'POST',
        host: '127.0.0.1:4173',
        origin: 'http://127.0.0.1:4173',
      }),
    ).toEqual({ allowed: true });
  });

  it('checks the origin of a read where same origin is demanded', () => {
    expect(
      check({ requireSameOrigin: true, origin: 'http://elsewhere.example' }),
    ).toEqual({
      allowed: false,
      reason: 'The origin http://elsewhere.example cannot write here',
    });
    expect(
      check({ requireSameOrigin: true, origin: 'http://127.0.0.1:4173' }),
    ).toEqual({ allowed: true });
  });
});
