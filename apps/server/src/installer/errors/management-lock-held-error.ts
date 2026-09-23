export class ManagementLockHeldError extends Error {
  override readonly name = 'ManagementLockHeldError';
  constructor() {
    super(
      'Another Porcelain service command is already running. Wait for it to finish.',
    );
  }
}
