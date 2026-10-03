import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineEndpoint, endpointPath } from './endpoint.ts';

const endpoint = defineEndpoint({
  method: 'GET',
  path: '/entries/:entryId',
  schema: {
    params: z.strictObject({ entryId: z.string() }),
    querystring: z.strictObject({
      path: z.string().optional(),
      after: z
        .codec(z.string(), z.array(z.string()), {
          decode: (value) => value.split(','),
          encode: (value) => value.join(','),
        })
        .optional(),
      limit: z.coerce.number().optional(),
    }),
    response: { 200: z.string() },
  },
  errors: {},
});

describe('endpointPath', () => {
  it('encodes a parameter as one path segment, including existing percent signs', () => {
    expect(
      endpointPath(endpoint, { params: { entryId: 'a/b #%2F' }, query: {} }),
    ).toBe('/api/entries/a%2Fb%20%23%252F');
  });

  it('encodes the wire value of a query codec and omits absent values', () => {
    expect(
      endpointPath(endpoint, {
        params: { entryId: 'one' },
        query: { after: ['a', 'b'], path: 'a & b', limit: 3 },
      }),
    ).toBe('/api/entries/one?path=a+%26+b&after=a%2Cb&limit=3');
    expect(
      endpointPath(endpoint, {
        params: { entryId: 'one' },
        query: { path: undefined },
      }),
    ).toBe('/api/entries/one');
  });

  it('refuses missing path parameters and invalid queries before making a URL', () => {
    expect(() => endpointPath(endpoint, { params: {}, query: {} })).toThrow();
    expect(() =>
      endpointPath(endpoint, {
        params: { entryId: 'one' },
        query: { limit: 'three' },
      }),
    ).toThrow();
  });
});
