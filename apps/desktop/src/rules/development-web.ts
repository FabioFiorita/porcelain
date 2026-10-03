const loopback = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function developmentWeb(
  packaged: boolean,
  value: string | boolean | undefined,
): string | undefined {
  if (packaged || value === undefined) return undefined;
  const address = typeof value === 'string' ? URL.parse(value) : null;
  if (
    address === null ||
    address.protocol !== 'http:' ||
    !loopback.has(address.hostname) ||
    address.username !== '' ||
    address.password !== '' ||
    address.pathname !== '/' ||
    address.search !== '' ||
    address.hash !== ''
  )
    throw new Error(
      '--web-dev-server must be the http origin of a loopback Vite server',
    );
  return address.origin;
}
