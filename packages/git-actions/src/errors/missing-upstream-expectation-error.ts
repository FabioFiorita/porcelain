export class MissingUpstreamExpectationError extends Error {
  override readonly name = 'MissingUpstreamExpectationError';

  constructor() {
    super('This action needs the upstream the client expects');
  }
}
