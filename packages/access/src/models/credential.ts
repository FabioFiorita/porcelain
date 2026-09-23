import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

export type CredentialKind = 'pcp' | 'pcd';

const secretBytes = 32;

export type MintedCredential = { id: string; secret: string; token: string };

export function mintCredential(kind: CredentialKind): MintedCredential {
  const id = randomUUID();
  const secret = randomBytes(secretBytes).toString('base64url');
  return { id, secret, token: `${kind}_${id}_${secret}` };
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export type ParsedCredential = { id: string; secret: string };

export function parseCredential(
  kind: CredentialKind,
  value: string,
): ParsedCredential | undefined {
  const match = new RegExp(
    `^${kind}_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_([A-Za-z0-9_-]{43})$`,
  ).exec(value);
  return match?.[1] && match[2]
    ? { id: match[1], secret: match[2] }
    : undefined;
}

export function secretMatches(expectedHex: string, secret: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = createHash('sha256').update(secret).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
