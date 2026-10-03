import type { Base64UrlSecret } from '../models/secret.ts';

export interface SecretSource {
  next(): Base64UrlSecret;
}
