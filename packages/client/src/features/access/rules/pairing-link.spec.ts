import { describe, expect, it } from 'vitest';
import {
  pairingPageUrl,
  parsePairingLink,
  remoteLink,
} from './pairing-link.ts';

const appLink = 'https://porcelain.fabiofiorita.com/open/pair';

describe('remoteLink', () => {
  it('reads a complete pairing link and decodes its code', () => {
    expect(
      remoteLink(' https://example.com:4738/pair#c=one%20time&e=installation '),
    ).toEqual({
      address: 'https://example.com:4738',
      code: 'one time',
      environmentId: 'installation',
    });
  });

  it('reads an app link and connects to the first address it carries', () => {
    expect(
      remoteLink(
        `${appLink}#c=one%20time&e=installation&a=${encodeURIComponent('http://192.168.1.10:4738,https://laptop.example.ts.net')}`,
      ),
    ).toEqual({
      address: 'http://192.168.1.10:4738',
      code: 'one time',
      environmentId: 'installation',
    });
  });

  it.each([
    'not a link',
    'ftp://example.com/pair#c=code&e=installation',
    'https://example.com/#c=code&e=installation',
    'https://example.com/pair#c=code',
    'https://example.com/pair#e=installation',
    'https://example.com/pair#c=&e=installation',
    `${appLink}#c=code&e=installation`,
    `${appLink}#c=code&e=installation&a=`,
    `${appLink}#c=code&e=installation&a=not%20an%20address`,
    `${appLink}#c=code&e=installation&a=${encodeURIComponent('javascript:alert(1)')}`,
    `${appLink}#e=installation&a=${encodeURIComponent('http://192.168.1.10:4738')}`,
    `https://porcelain.fabiofiorita.com/open/reviews#c=code&e=installation&a=${encodeURIComponent('http://192.168.1.10:4738')}`,
  ])('refuses an unusable pairing link %j', (value) => {
    expect(remoteLink(value)).toBeUndefined();
  });
});

describe('pairingPageUrl', () => {
  it('opens the pairing page of the address with only the code and environment', () => {
    expect(
      pairingPageUrl({
        address: 'http://192.168.1.10:4738',
        code: 'one time',
        environmentId: 'installation',
      }),
    ).toBe('http://192.168.1.10:4738/pair#c=one%20time&e=installation');
  });
});

describe('parsePairingLink', () => {
  it('reads a pairing code and installation id from a fragment', () => {
    expect(parsePairingLink('#c=one%20time&e=installation')).toEqual({
      code: 'one time',
      environmentId: 'installation',
    });
  });
});
