import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Credentials are `<prefix>_<id>_<secret>`. The id is not secret: it makes the
 * lookup one indexed read, after which exactly one digest is compared. A bare
 * secret would force a scan comparing every stored digest, which is both O(n)
 * and a timing signal for how many exist.
 */
export type CredentialKind = 'pcp' | 'pcd';

/** 256 bits from the platform CSPRNG. A v4 UUID would carry 122. */
const secretBytes = 32;

export type MintedCredential = { id: string; secret: string; token: string };

export function mintCredential(kind: CredentialKind): MintedCredential {
  const id = randomUUID();
  const secret = randomBytes(secretBytes).toString('base64url');
  return { id, secret, token: `${kind}_${id}_${secret}` };
}

export function hashSecret(secret: string): string {
  // The secret is 256 random bits, not a password: there is nothing to slow an
  // attacker down against, so a KDF would only add cost to every request.
  return createHash('sha256').update(secret).digest('hex');
}

export type ParsedCredential = { id: string; secret: string };

/**
 * Parse without touching the database. A malformed token is rejected here, so a
 * flood of junk costs a regex rather than a hash and an indexed read.
 */
export function parseCredential(
  kind: CredentialKind,
  value: string,
): ParsedCredential | null {
  const match = new RegExp(
    `^${kind}_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_([A-Za-z0-9_-]{43})$`,
  ).exec(value);
  return match?.[1] && match[2] ? { id: match[1], secret: match[2] } : null;
}

/** Constant-time comparison of two equal-length hex digests. */
export function secretMatches(expectedHex: string, secret: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = createHash('sha256').update(secret).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
