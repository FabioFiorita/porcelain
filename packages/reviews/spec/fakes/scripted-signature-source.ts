import type { SignatureSource } from '../../src/ports/signature-source.ts';

export class ScriptedSignatureSource implements SignatureSource {
  sign(input: { secret: string; message: string }): string {
    return `${input.secret}:${input.message}`;
  }
}
