export class InvalidTailnetHostnameError extends Error {
  override readonly name = 'InvalidTailnetHostnameError';
  constructor() {
    super(
      "Enter this computer's Tailscale name, such as laptop.tail1234.ts.net.",
    );
  }
}
