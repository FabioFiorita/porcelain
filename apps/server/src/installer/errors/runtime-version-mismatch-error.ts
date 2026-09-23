export class RuntimeVersionMismatchError extends Error {
  override readonly name = 'RuntimeVersionMismatchError';
  constructor(reported: string | undefined, expected: string) {
    super(
      `Persistent runtime reported ${reported ?? 'no version'} instead of ${expected}.`,
    );
  }
}
