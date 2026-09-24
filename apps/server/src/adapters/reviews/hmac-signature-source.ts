import { createHmac } from 'node:crypto';
import type { SignatureSource } from '@porcelain/reviews/ports';

export class HmacSignatureSource implements SignatureSource {
  sign(input: { secret: string; message: string }): string {
    return createHmac('sha256', input.secret)
      .update(input.message)
      .digest('base64url');
  }
}
