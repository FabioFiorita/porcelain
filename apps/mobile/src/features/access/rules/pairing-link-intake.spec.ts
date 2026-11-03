import { describe, expect, it } from 'vitest';
import { pairingIntentPath, scannedPairingLink } from './pairing-link-intake';

const appLink =
  'https://porcelain.fabiofiorita.com/open/pair#c=one-time&e=computer&a=http%3A%2F%2F192.168.1.20%3A4555';
const pageLink = 'http://192.168.1.20:4555/pair#c=one-time&e=computer';

describe('pairingIntentPath', () => {
  it('routes an app pairing link to its screen without the secret fragment', () => {
    expect(pairingIntentPath(appLink)).toBe('/open/pair');
  });

  it('strips the fragment from an app-scheme or trailing-slash pairing link', () => {
    expect(
      pairingIntentPath('porcelain.dev://open/pair#c=one-time&e=computer'),
    ).toBe('/open/pair');
    expect(
      pairingIntentPath(
        'https://porcelain.fabiofiorita.com/open/pair/#c=one-time&e=computer',
      ),
    ).toBe('/open/pair');
  });

  it('leaves review links and app scheme links for the router', () => {
    const review =
      'https://porcelain.fabiofiorita.com/open/reviews/abc?environment=computer';
    expect(pairingIntentPath(review)).toBe(review);
    expect(pairingIntentPath('porcelain.dev://settings')).toBe(
      'porcelain.dev://settings',
    );
  });
});

describe('scannedPairingLink', () => {
  it('accepts both pairing link formats', () => {
    expect(scannedPairingLink(`${appLink}\n`)).toBe(appLink);
    expect(scannedPairingLink(pageLink)).toBe(pageLink);
  });

  it('ignores QR codes that are not pairing links', () => {
    expect(scannedPairingLink('https://example.com/menu')).toBeUndefined();
    expect(
      scannedPairingLink(
        'https://porcelain.fabiofiorita.com/open/reviews/abc?environment=computer',
      ),
    ).toBeUndefined();
    expect(
      scannedPairingLink('WIFI:S:Office;T:WPA;P:secret;;'),
    ).toBeUndefined();
  });
});
