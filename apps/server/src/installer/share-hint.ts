const LOOPBACK_HOSTS = new Set(['localhost', '::1', '[::1]']);

export function localNetworkHint(host: string | undefined): string | undefined {
  if (
    host === undefined ||
    LOOPBACK_HOSTS.has(host.toLowerCase()) ||
    host.startsWith('127.')
  )
    return undefined;
  return `The service now listens on this computer only, no longer on ${host}. Share it on the local network again with: porcelain share lan on`;
}
