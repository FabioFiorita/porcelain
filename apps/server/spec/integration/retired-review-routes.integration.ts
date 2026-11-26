import { expect } from 'vite-plus/test';
import { test } from '../kit/server-test.ts';

const RETIRED_CONVERSATION_POSTING_ROUTES = [
  'GET /api/worktrees/:worktreeId/walkthrough/:runId/conversations/brief',
  'POST /api/worktrees/:worktreeId/walkthrough/:runId/conversations/messages/:messageId/post',
  'POST /api/worktrees/:worktreeId/walkthrough/:runId/conversations/post-saved',
  'PUT /api/worktrees/:worktreeId/walkthrough/:runId/conversations/messages/:messageId/saved',
];

test('old review, worktree discussion and conversation posting routes are absent while walkthrough and reviewed routes stay registered', async ({
  session,
  server,
}) => {
  expect(
    server.routes.some(
      (route) =>
        route.includes('/api/reviews/') ||
        route.includes('/review-summaries/') ||
        /\/comments\/(?::threadId|resolved)/.test(route),
    ),
  ).toBe(false);
  expect(
    server.routes.filter((route) =>
      RETIRED_CONVERSATION_POSTING_ROUTES.includes(route),
    ),
  ).toEqual([]);
  for (const path of [
    `/api/worktrees/${session.worktreeId}/review`,
    `/api/worktrees/${session.worktreeId}/comments/00000000-0000-4000-8000-000000000001/messages`,
    `/api/worktrees/${session.worktreeId}/comments/resolved/deletion`,
    `/api/reviews/00000000-0000-4000-8000-000000000001`,
  ]) {
    expect((await session.send({ method: 'GET', path })).status, path).toBe(
      404,
    );
  }
  expect(
    (
      await session.send({
        method: 'GET',
        path: `/api/worktrees/${session.worktreeId}/walkthrough`,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await session.send({
        method: 'GET',
        path: `/api/worktrees/${session.worktreeId}/reviewed`,
      })
    ).status,
  ).toBe(200);
});
