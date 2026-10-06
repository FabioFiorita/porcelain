import { Context } from 'effect';
import type { Base64UrlSecret } from '../models/secret.ts';

export interface SecretSource {
  next(): Base64UrlSecret;
}

export const SecretSource = Context.Service<
  '@porcelain/kernel/SecretSource',
  SecretSource
>('@porcelain/kernel/SecretSource');
