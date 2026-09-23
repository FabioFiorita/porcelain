export class UpdateFailedError extends Error {
  override readonly name = 'UpdateFailedError';
  constructor(recovery: string, detail: string) {
    super(`Porcelain update failed; ${recovery}. ${detail}`.trim());
  }
}
