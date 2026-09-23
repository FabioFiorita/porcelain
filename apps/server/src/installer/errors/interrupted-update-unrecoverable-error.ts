export class InterruptedUpdateUnrecoverableError extends Error {
  override readonly name = 'InterruptedUpdateUnrecoverableError';
  constructor() {
    super(
      'An interrupted update has neither the installed nor previous runtime. Preserve the service directory for manual recovery.',
    );
  }
}
