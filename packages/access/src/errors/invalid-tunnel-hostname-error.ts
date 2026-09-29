export class InvalidTunnelHostnameError extends Error {
  override readonly name = 'InvalidTunnelHostnameError';
  constructor() {
    super(
      'Enter the public hostname your Cloudflare tunnel serves, such as porcelain.example.com.',
    );
  }
}
