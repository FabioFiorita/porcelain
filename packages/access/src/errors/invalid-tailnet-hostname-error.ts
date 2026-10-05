import { Schema } from 'effect';

export class InvalidTailnetHostnameError extends Schema.TaggedError<InvalidTailnetHostnameError>()(
  'InvalidTailnetHostnameError',
  {},
) {
  override get message() {
    return "Enter this computer's Tailscale name, such as laptop.tail1234.ts.net.";
  }
}
