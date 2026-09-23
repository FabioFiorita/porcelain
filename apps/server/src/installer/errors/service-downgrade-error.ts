export class ServiceDowngradeError extends Error {
  override readonly name = 'ServiceDowngradeError';
  constructor(installed: string, candidate: string) {
    super(
      `Refusing to replace Porcelain ${installed} with older ${candidate}. Run again with --allow-downgrade to continue.`,
    );
  }
}
