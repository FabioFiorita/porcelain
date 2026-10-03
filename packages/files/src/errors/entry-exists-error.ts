export class EntryExistsError extends Error {
  override readonly name = 'EntryExistsError';

  constructor() {
    super('An entry already exists at that path');
  }
}
