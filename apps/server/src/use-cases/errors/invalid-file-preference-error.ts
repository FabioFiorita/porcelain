export class InvalidFilePreferenceError extends Error {
  constructor() {
    super('Invalid file preference');
    this.name = 'InvalidFilePreferenceError';
  }
}
