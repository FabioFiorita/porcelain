import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { pairingLinkSchema } from './pairing-link.ts';

const oneAddress = {
  addresses: ['http://192.168.1.10:3000'],
  code: 'pcp_first',
  environmentId: 'environment-1',
};

const twoAddresses = {
  addresses: ['http://192.168.1.10:3000', 'http://porcelain.local:3000'],
  code: 'pcp_second',
  environmentId: 'environment-1',
};

describe('pairingLinkSchema', () => {
  it('opens the pair page of the only address, with the code and environment in the fragment', () => {
    expect(Schema.encodeSync(pairingLinkSchema)(oneAddress)).toBe(
      'http://192.168.1.10:3000/pair#c=pcp_first&e=environment-1',
    );
  });

  it('reads the parts back from a link to one address', () => {
    expect(
      Schema.decodeUnknownSync(pairingLinkSchema)(
        'http://192.168.1.10:3000/pair#c=pcp_first&e=environment-1',
      ),
    ).toEqual(oneAddress);
  });

  it('opens the first address and carries every address when there are several', () => {
    const link = Schema.encodeSync(pairingLinkSchema)(twoAddresses);
    expect(link).toMatch(/^http:\/\/192\.168\.1\.10:3000\/pair#/);
    expect(Schema.decodeUnknownSync(pairingLinkSchema)(link)).toEqual(
      twoAddresses,
    );
  });

  it('keeps a code and environment that hold fragment separators intact', () => {
    const hostile = {
      addresses: ['http://192.168.1.10:3000'],
      code: 'a&c=b#c',
      environmentId: 'e=1&a=http://elsewhere',
    };
    expect(
      Schema.decodeUnknownSync(pairingLinkSchema)(
        Schema.encodeSync(pairingLinkSchema)(hostile),
      ),
    ).toEqual(hostile);
  });

  it('reads an empty code and environment from a link that carries neither', () => {
    expect(
      Schema.decodeUnknownSync(pairingLinkSchema)(
        'http://192.168.1.10:3000/pair#',
      ),
    ).toEqual({
      addresses: ['http://192.168.1.10:3000'],
      code: '',
      environmentId: '',
    });
  });

  it('opens the app link page with the code, the environment and every address in the fragment', () => {
    expect(
      Schema.encodeSync(pairingLinkSchema)({
        ...oneAddress,
        appOrigin: 'https://porcelain.fabiofiorita.com',
      }),
    ).toBe(
      'https://porcelain.fabiofiorita.com/open/pair#c=pcp_first&e=environment-1&a=http%3A%2F%2F192.168.1.10%3A3000',
    );
  });

  it('reads the parts and the app origin back from an app link', () => {
    expect(
      Schema.decodeUnknownSync(pairingLinkSchema)(
        'https://porcelain.fabiofiorita.com/open/pair#c=pcp_second&e=environment-1&a=http%3A%2F%2F192.168.1.10%3A3000%2Chttp%3A%2F%2Fporcelain.local%3A3000',
      ),
    ).toEqual({
      ...twoAddresses,
      appOrigin: 'https://porcelain.fabiofiorita.com',
    });
  });

  it.each([
    'http://192.168.1.10:3000/pair',
    'http://192.168.1.10:3000/reviews#c=pcp_first&e=environment-1',
    'https://porcelain.fabiofiorita.com/open/pair#c=pcp_first&e=environment-1',
    'https://porcelain.fabiofiorita.com/open/pair#c=pcp_first&e=environment-1&a=',
    'http://192.168.1.10:3000/pair#c=%E0%A4%A&e=environment-1',
  ])('refuses a link that is not a pairing link %j', (link) => {
    expect(() => Schema.decodeUnknownSync(pairingLinkSchema)(link)).toThrow(
      'Expected a Porcelain pairing link',
    );
  });
});
