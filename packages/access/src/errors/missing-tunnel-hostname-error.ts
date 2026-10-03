export class MissingTunnelHostnameError extends Error {
  override readonly name = 'MissingTunnelHostnameError';
  constructor() {
    super('Cloudflare needs the public hostname your tunnel serves.');
  }
}
