import type { FormEvent } from 'react';

// Mutation state owns the visible failure; handlers must still consume the
// rejection so it does not surface as an unhandled promise.
export function discardRejection(promise: Promise<unknown>) {
  void promise.catch(() => undefined);
}

export function submitForm(
  event: FormEvent<HTMLFormElement>,
  submit: () => Promise<unknown>,
) {
  event.preventDefault();
  discardRejection(submit());
}
