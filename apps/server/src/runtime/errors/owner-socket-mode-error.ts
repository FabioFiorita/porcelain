export class OwnerSocketModeError extends Error {
  override readonly name = 'OwnerSocketModeError';
  constructor(path: string, mode: number) {
    super(
      `The owner socket ${path} has mode ${mode.toString(8).padStart(3, '0')} instead of 600.`,
    );
  }
}
