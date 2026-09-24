export class ProviderProcessFailedError extends Error {
  override readonly name = 'ProviderProcessFailedError';

  constructor(options?: ErrorOptions) {
    super(
      'Commit generation failed. Check that the selected CLI is up to date and signed in.',
      options,
    );
  }
}
