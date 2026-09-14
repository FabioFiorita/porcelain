/**
 * Create an identifier on both secure and plain HTTP origins.
 *
 * Browsers expose `crypto.randomUUID` only in secure contexts (plus
 * localhost). Porcelain is also served over a LAN or tailnet, where
 * `getRandomValues` remains available but `randomUUID` may not be.
 */
export function createId(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function')
    return webCrypto.randomUUID();

  const bytes = webCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
