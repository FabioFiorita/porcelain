import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const LIFETIME_MS = 30 * 60 * 1000;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

type FileTarget = { readonly worktreeId: string; readonly path: string };

function associatedData(target: FileTarget) {
  return Buffer.from(JSON.stringify([target.worktreeId, target.path]));
}

export function previewFileTickets() {
  const key = randomBytes(32);
  return {
    issue(target: FileTarget, credential: string, now: number): string {
      const nonce = randomBytes(NONCE_BYTES);
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      cipher.setAAD(associatedData(target));
      const encrypted = cipher.update(`${now + LIFETIME_MS}:${credential}`);
      return Buffer.concat([
        nonce,
        encrypted,
        cipher.final(),
        cipher.getAuthTag(),
      ]).toString('base64url');
    },
    redeem(
      target: FileTarget,
      ticket: string,
      now: number,
    ): string | undefined {
      if (!/^[\w-]{1,1024}$/.test(ticket)) return undefined;
      const bytes = Buffer.from(ticket, 'base64url');
      if (
        bytes.length <= NONCE_BYTES + TAG_BYTES ||
        bytes.toString('base64url') !== ticket
      )
        return undefined;
      try {
        const decipher = createDecipheriv(
          'aes-256-gcm',
          key,
          bytes.subarray(0, NONCE_BYTES),
        );
        decipher.setAAD(associatedData(target));
        decipher.setAuthTag(bytes.subarray(-TAG_BYTES));
        const payload = Buffer.concat([
          decipher.update(bytes.subarray(NONCE_BYTES, -TAG_BYTES)),
          decipher.final(),
        ]).toString();
        const separator = payload.indexOf(':');
        if (Number(payload.slice(0, separator)) <= now) return undefined;
        return payload.slice(separator + 1);
      } catch {
        return undefined;
      }
    },
  };
}

export type PreviewFileTickets = ReturnType<typeof previewFileTickets>;
