export function encodeBase64(bytes: Uint8Array, chunkBytes: number): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += chunkBytes)
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkBytes));
  return btoa(binary);
}
