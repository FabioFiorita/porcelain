import type { FormEvent } from 'react';

export function submitForm(
  event: FormEvent<HTMLFormElement>,
  submit: () => Promise<unknown>,
) {
  event.preventDefault();
  // Mutation state owns the visible failure; event handlers must consume rejections.
  void submit().catch(() => undefined);
}
