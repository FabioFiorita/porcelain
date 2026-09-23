export class SelectionMismatchError extends Error {
  override readonly name = 'SelectionMismatchError';

  constructor() {
    super('Selections must cover exactly the expected files');
  }
}
