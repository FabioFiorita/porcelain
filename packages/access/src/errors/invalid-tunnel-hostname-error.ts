import { Schema } from 'effect';

export class InvalidTunnelHostnameError extends Schema.TaggedError<InvalidTunnelHostnameError>()(
  'InvalidTunnelHostnameError',
  {},
) {
  override get message() {
    return 'Enter the public hostname your Cloudflare tunnel serves, such as porcelain.example.com.';
  }
}
