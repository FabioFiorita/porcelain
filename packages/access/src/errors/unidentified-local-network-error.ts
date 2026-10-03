export class UnidentifiedLocalNetworkError extends Error {
  override readonly name = 'UnidentifiedLocalNetworkError';
  constructor() {
    super(
      'Porcelain cannot tell this network from another one yet, because the hardware address of its router is not known. Try again in a moment.',
    );
  }
}
