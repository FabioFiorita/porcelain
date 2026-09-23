export class InstalledServiceUnhealthyError extends Error {
  override readonly name = 'InstalledServiceUnhealthyError';
  constructor() {
    super('The installed service did not become healthy.');
  }
}
