import { constantTimeEquals, sha256Hex } from '@porcelain/kernel/rules';
import type {
  Credential,
  CredentialKind,
  CredentialParts,
} from '../models/credential.ts';

const ID_PATTERN =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SECRET_PATTERN = '[A-Za-z0-9_-]{43}';

export function credential(
  kind: CredentialKind,
  id: string,
  secret: string,
): Credential {
  return { id, secret, token: `${kind}_${id}_${secret}` };
}

export function parseCredential(
  kind: CredentialKind,
  value: string,
): CredentialParts | undefined {
  const match = new RegExp(
    `^${kind}_(${ID_PATTERN})_(${SECRET_PATTERN})$`,
  ).exec(value);
  return match?.[1] && match[2]
    ? { id: match[1], secret: match[2] }
    : undefined;
}

export function secretMatches(expectedHash: string, secret: string): boolean {
  return constantTimeEquals(expectedHash, sha256Hex(secret));
}
