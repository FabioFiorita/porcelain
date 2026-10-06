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
});
