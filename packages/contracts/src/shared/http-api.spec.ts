import { Schema, SchemaGetter } from 'effect';
import {
  HttpApi,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiGroup,
} from 'effect/http-api';
import { describe, expect, it } from 'vitest';

const frontier = Schema.String.pipe(
  Schema.decodeTo(Schema.Array(Schema.String), {
    decode: SchemaGetter.transform((text: string) => text.split(',')),
    encode: SchemaGetter.transform((values: readonly string[]) =>
      values.join(','),
    ),
  }),
);
const entryParams = Schema.Struct({ entryId: Schema.String });
const entryQuery = {
  path: Schema.optionalKey(Schema.String),
  after: Schema.optionalKey(frontier),
  limit: Schema.optionalKey(Schema.NumberFromString.check(Schema.isInt())),
};
class EntriesApi extends HttpApi.make('entries').add(
  HttpApiGroup.make('entries').add(
    HttpApiEndpoint.get('read', '/api/entries/:entryId', {
      disableCodecs: true,
      params: entryParams,
      query: entryQuery,
      success: Schema.String,
    }),
  ),
) {}
const urls = HttpApiClient.urlBuilder(EntriesApi).entries;

describe('native contract URL encoding', () => {
  it('encodes a parameter as one segment, including existing percent signs', () => {
    expect(urls.read({ params: { entryId: 'a/b #%2F' }, query: {} })).toBe(
      '/api/entries/a%2Fb%20%23%252F',
    );
  });

  it('encodes query codecs and omits absent values', () => {
    expect(
      urls.read({
        params: { entryId: 'one' },
        query: { after: ['a', 'b'], path: 'a & b', limit: 3 },
      }),
    ).toBe('/api/entries/one?path=a+%26+b&after=a%2Cb&limit=3');
    expect(urls.read({ params: { entryId: 'one' }, query: {} })).toBe(
      '/api/entries/one',
    );
  });

  it('refuses missing parameters and invalid query values before IO', () => {
    expect(() => Schema.decodeUnknownSync(entryParams)({})).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(Schema.Struct(entryQuery))({ limit: 'three' }),
    ).toThrow();
  });
});
