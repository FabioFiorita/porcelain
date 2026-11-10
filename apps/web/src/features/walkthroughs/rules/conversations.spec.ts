import { expect, it } from 'vitest';
import {
  earlierConversations,
  postControls,
  conversationFailure,
  type DeveloperMessage,
} from './conversations';

const message: DeveloperMessage = {
  author: 'developer',
  id: 'a',
  text: 'Why?',
  createdAt: '',
  post: { status: 'none' },
};
it('offers posting until saved, Undo while saved, and only the link once posted', () => {
  expect(postControls(message)).toBe('available');
  expect(postControls({ ...message, post: { status: 'saved' } })).toBe('saved');
  expect(
    postControls({
      ...message,
      post: {
        status: 'posted',
        url: 'https://example.com/comment',
        postedAt: '',
      },
    }),
  ).toBe('posted');
});
it('keeps whole-walkthrough and removed-stop threads together near the end', () => {
  const whole = {
    runId: 'old',
    anchor: { kind: 'walkthrough' as const },
    messages: [message],
  };
  const removed = {
    runId: 'old',
    anchor: { kind: 'stop' as const, title: 'Removed stop' },
    messages: [message],
  };
  const current = {
    runId: 'run',
    anchor: { kind: 'stop' as const, title: 'Kept stop' },
    messages: [message],
  };
  expect(
    earlierConversations(
      {
        runId: 'run',
        pullRequestNumber: undefined,
        conversations: [whole, current, removed],
      },
      ['Kept stop'],
    ),
  ).toEqual([whole, removed]);
});
it('explains a refused post and offers the brief without hiding other failures', () => {
  expect(conversationFailure({ status: 409, message: 'Moved' })).toEqual({
    text: 'Nothing was posted. Copy the brief instead.',
    copy: true,
  });
  expect(
    conversationFailure(
      Object.assign(new Error('The repository moved.'), {
        name: 'WalkthroughRepositoryChangedError',
      }),
    ),
  ).toEqual({
    text: 'Nothing was posted. Copy the brief instead.',
    copy: true,
  });
  expect(conversationFailure(new Error('Offline'))).toEqual({
    text: 'Offline',
    copy: false,
  });
});
