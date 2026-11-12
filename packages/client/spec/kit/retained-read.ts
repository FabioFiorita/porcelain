import { Atom, AtomRegistry, AsyncResult } from 'effect/reactivity';
import { retainRead } from '../../src/shared/api/worktree-read.ts';

export function retainedReadFixture(registry = AtomRegistry.make()) {
  let answer: AsyncResult.AsyncResult<string, string> =
    AsyncResult.success('confirmed');
  const source = Atom.make(() => answer).pipe(Atom.setIdleTTL(0));
  return {
    registry,
    read: retainRead(source),
    answer(next: AsyncResult.AsyncResult<string, string>) {
      answer = next;
    },
  };
}
