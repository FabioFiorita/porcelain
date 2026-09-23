import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  Credential,
  CredentialKind,
  CredentialParts,
} from '../models/credential.ts';

const secretBytes = 32;
const idPattern =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const secretPattern = '[A-Za-z0-9_-]{43}';

export function mintCredential(kind: CredentialKind, id: string): Credential {
  const secret = randomBytes(secretBytes).toString('base64url');
  return { id, secret, token: `${kind}_${id}_${secret}` };
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function parseCredential(
  kind: CredentialKind,
  value: string,
): CredentialParts | undefined {
  const match = new RegExp(`^${kind}_(${idPattern})_(${secretPattern})$`).exec(
    value,
  );
  return match?.[1] && match[2]
    ? { id: match[1], secret: match[2] }
    : undefined;
}

export function secretMatches(expectedHash: string, secret: string): boolean {
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = createHash('sha256').update(secret).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
