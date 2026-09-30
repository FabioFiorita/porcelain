export class MissingTailnetHostnameError extends Error {
  override readonly name = 'MissingTailnetHostnameError';
  constructor() {
    super("Tailscale needs this computer's Tailscale name.");
  }
}
