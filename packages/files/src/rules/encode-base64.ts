const CHUNK_BYTES = 0x8000;

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += CHUNK_BYTES)
    binary += String.fromCharCode(
      ...bytes.subarray(start, start + CHUNK_BYTES),
    );
  return btoa(binary);
}
