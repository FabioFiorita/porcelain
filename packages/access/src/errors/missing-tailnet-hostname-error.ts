import { Schema } from 'effect';

export class MissingTailnetHostnameError extends Schema.TaggedError<MissingTailnetHostnameError>()(
  'MissingTailnetHostnameError',
  {},
) {
  override get message() {
    return "Tailscale needs this computer's Tailscale name.";
  }
}
