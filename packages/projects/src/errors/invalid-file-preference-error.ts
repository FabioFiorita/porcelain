export class InvalidFilePreferenceError extends Error {
  override readonly name = 'InvalidFilePreferenceError';

  constructor() {
    super('Invalid file preference');
  }
}
