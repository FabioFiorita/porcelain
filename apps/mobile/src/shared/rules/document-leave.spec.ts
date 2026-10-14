import { expect, it } from 'vitest';
import { leaveDocuments } from './document-leave';

it('runs the navigation immediately when no document needs protection', () => {
  let navigated = false;
  leaveDocuments([], () => {
    navigated = true;
  });
  expect(navigated).toBe(true);
});

it('waits for every pane to allow leaving before changing the workspace', () => {
  const events: string[] = [];
  let confirm: (() => void) | undefined;
  leaveDocuments(
    [
      (leave) => {
        events.push('save-left');
        leave();
      },
      (leave) => {
        events.push('confirm-right-comment');
        confirm = leave;
      },
    ],
    () => events.push('change-workspace'),
  );
  expect(events).toEqual(['save-left', 'confirm-right-comment']);
  confirm?.();
  expect(events).toEqual([
    'save-left',
    'confirm-right-comment',
    'change-workspace',
  ]);
});

it('keeps the current document when a guard cancels or a save does not succeed', () => {
  const events: string[] = [];
  leaveDocuments(
    [
      () => events.push('keep-editing'),
      (leave) => {
        events.push('other-pane');
        leave();
      },
    ],
    () => events.push('close-tab'),
  );
  expect(events).toEqual(['keep-editing']);
});
