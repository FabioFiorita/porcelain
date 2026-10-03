export function createId(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function')
    return webCrypto.randomUUID();

  const address = URL.createObjectURL(new Blob());
  URL.revokeObjectURL(address);
  return address.slice(address.lastIndexOf('/') + 1);
}
