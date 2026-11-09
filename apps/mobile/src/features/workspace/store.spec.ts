import { AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vitest';
import { commentDraftState, type CommentDraft } from './store';

it('retains unsent text, its original review target and write identity when a PR replaces the active document', () => {
  const scheduled: Array<() => void> = [];
  const registry = AtomRegistry.make({
    scheduleTask: (task) => {
      scheduled.push(task);
      return () => undefined;
    },
  });
  const document = commentDraftState('desk/project/topic/left/review');
  const draft: CommentDraft = {
    target: {
      anchor: { kind: 'change' },
      reviewId: 'original-review',
      reviewRevision: 3,
    },
    body: 'Keep this unsent comment while I read the PR',
    invalid: undefined,
    intent: {
      body: 'Keep this unsent comment while I read the PR',
      threadId: 'original-thread',
      messageId: 'original-message',
    },
  };
  try {
    const unmount = registry.mount(document);
    registry.set(document, draft);
    unmount();
    while (scheduled.length) scheduled.shift()!();
    const remount = registry.mount(document);
    expect(registry.get(document)).toEqual(draft);
    expect(
      registry.get(
        commentDraftState('other-computer/project/topic/left/review'),
      ),
    ).toBeUndefined();
    expect(
      registry.get(commentDraftState('desk/project/another-topic/left/review')),
    ).toBeUndefined();
    remount();
  } finally {
    registry.dispose();
  }
});
