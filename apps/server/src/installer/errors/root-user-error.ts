export class RootUserError extends Error {
  override readonly name = 'RootUserError';
  constructor() {
    super(
      'Refusing to manage Porcelain as root. Run this command as the user who will use Porcelain.',
    );
  }
}
