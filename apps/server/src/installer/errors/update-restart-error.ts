export class UpdateRestartError extends Error {
  override readonly name = 'UpdateRestartError';
  constructor(detail: string) {
    super(
      `Porcelain update failed before replacement and the previous service could not restart. ${detail}`,
    );
  }
}
