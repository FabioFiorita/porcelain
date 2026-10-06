import { Schema } from 'effect';

export class MissingTunnelHostnameError extends Schema.TaggedError<MissingTunnelHostnameError>()(
  'MissingTunnelHostnameError',
  {},
) {
  override get message() {
    return 'Cloudflare needs the public hostname your tunnel serves.';
  }
}
