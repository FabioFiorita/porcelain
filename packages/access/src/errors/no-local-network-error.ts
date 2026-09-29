export class NoLocalNetworkError extends Error {
  override readonly name = 'NoLocalNetworkError';
  constructor() {
    super(
      'This computer is not on a local network right now, so there is no network to share on.',
    );
  }
}
