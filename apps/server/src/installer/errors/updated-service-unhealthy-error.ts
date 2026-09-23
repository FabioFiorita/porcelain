export class UpdatedServiceUnhealthyError extends Error {
  override readonly name = 'UpdatedServiceUnhealthyError';
  constructor() {
    super('The updated service did not become healthy.');
  }
}
