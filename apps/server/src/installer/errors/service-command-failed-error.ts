export class ServiceCommandFailedError extends Error {
  override readonly name = 'ServiceCommandFailedError';
  constructor(description: string, detail: string) {
    super(`${description} failed: ${detail}`);
  }
}
