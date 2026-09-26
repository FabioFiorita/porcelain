import { randomUUID } from 'node:crypto';
import {
  apiError,
  defineCase,
  defineFeature,
  list,
  record,
  text,
  type Session,
} from '../scripts/feature.ts';
import {
  read,
  sampleReview,
  toolCall,
  toolResult,
  toolText,
  toolValue,
  worktreePath,
} from '../scripts/fixture.ts';

const layerId = randomUUID();
const stepId = randomUUID();
const agentThreadId = randomUUID();
const agentMessageId = randomUUID();
const outside = apiError(
  404,
  'Not Found',
  'No registered Porcelain worktree contains this path',
);

const review = (session: Session) =>
  read(session, { method: 'GET', path: worktreePath(session, '/review') });
const threads = async (session: Session) =>
  list(
    (
      await session.read({
        method: 'GET',
        path: worktreePath(session, '/comments'),
      })
    ).body,
  );
const threadWith = (entries: unknown[], id: string) =>
  entries.filter((entry) => record(entry).id === id);
const answered = (id: number) => ({
  jsonrpc: '2.0',
  id,
  result: { content: [{ type: 'text' }] },
});

async function reviewerThread(session: Session) {
  const found = (await threads(session)).find(
    (entry) => record(list(record(entry).messages)[0]).author === 'reviewer',
  );
  return text(record(found).id);
}

export default defineFeature({
  feature: 'reviews.review-tools',
  reaches: 'owner POST /mcp',
  paired: false,
  intent: 'observed',
  behaviour:
    "A coding agent reaches the review tools over MCP on the owner socket, as tools/call requests. Each tool acts on the registered worktree that contains the MCP process's working directory (the x-porcelain-cwd header, or a cwd argument): publish_review publishes the review a reviewer then reads over HTTP, read_review reads the published review, create_comment and reply_to_comment write as the agent, list_comments lists the unresolved threads whose latest message is not the agent's (or every thread with scope all) and resolve_comment resolves a thread. A tool answers its value as JSON text; a failure is a tool error carrying the HTTP error body, and a directory outside every registered worktree is not found and changes nothing.",
  cases: [
    defineCase({
      name: 'publish_review',
      request: (session) =>
        toolCall(
          session,
          1,
          'publish_review',
          sampleReview(session, 0, layerId, stepId),
        ),
      async expect({ response, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial('a tool answer', answered(1), response.body);
        check(
          'not an error',
          ['content'],
          Object.keys(toolResult(response.body)),
        );
        checkPartial(
          'the published review',
          {
            review: { revision: 1, layers: [{ id: layerId, title: 'Readme' }] },
          },
          toolValue(response.body),
        );
        checkPartial(
          'a reviewer reads it over HTTP',
          {
            review: { revision: 1, layers: [{ id: layerId, title: 'Readme' }] },
          },
          await review(session),
        );
      },
    }),
    defineCase({
      name: 'read_review',
      setup: review,
      request: (session) => toolCall(session, 2, 'read_review', {}),
      expect({ response, state, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial('a tool answer', answered(2), response.body);
        const value = record(record(toolValue(response.body)).review);
        check(
          'the revision a reviewer reads',
          record(state.review).revision,
          value.revision,
        );
        check(
          'the layers a reviewer reads',
          record(state.review).layers,
          value.layers,
        );
      },
    }),
    defineCase({
      name: 'create_comment',
      request: (session) =>
        toolCall(session, 3, 'create_comment', {
          threadId: agentThreadId,
          messageId: agentMessageId,
          anchor: { kind: 'file', filePath: session.fixture.readme.path },
          body: 'From the agent',
        }),
      async expect({ response, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial('a tool answer', answered(3), response.body);
        const written = {
          id: agentThreadId,
          resolved: false,
          messages: [
            { id: agentMessageId, body: 'From the agent', author: 'agent' },
          ],
        };
        checkPartial('the written thread', written, toolValue(response.body));
        checkPartial(
          'a reviewer sees the agent thread',
          [written],
          threadWith(await threads(session), agentThreadId),
        );
      },
    }),
    defineCase({
      name: 'list_comments',
      async setup(session) {
        await read(session, {
          method: 'POST',
          path: worktreePath(session, '/comments'),
          body: {
            anchor: { kind: 'file', filePath: session.fixture.readme.path },
            body: 'From the reviewer',
          },
        });
        return reviewerThread(session);
      },
      request: (session) => [
        toolCall(session, 4, 'list_comments', {}),
        toolCall(session, 5, 'list_comments', { scope: 'all' }),
      ],
      expect({ responses, state, check, checkPartial }) {
        check('waiting status', 200, responses[0]?.status);
        checkPartial(
          'only the reviewer thread waits for the agent',
          [
            {
              id: state,
              messages: [{ body: 'From the reviewer', author: 'reviewer' }],
            },
          ],
          toolValue(responses[0]?.body),
        );
        check('all status', 200, responses[1]?.status);
        check(
          'every thread with scope all',
          [agentThreadId, state].sort(),
          list(toolValue(responses[1]?.body))
            .map((entry) => text(record(entry).id))
            .sort(),
        );
      },
    }),
    defineCase({
      name: 'reply_to_comment',
      setup: reviewerThread,
      request: (session, threadId) =>
        toolCall(session, 6, 'reply_to_comment', {
          threadId,
          body: 'Answered by the agent',
        }),
      async expect({ response, state, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial('a tool answer', answered(6), response.body);
        checkPartial(
          'the reply is the agent',
          {
            id: state,
            messages: [
              { body: 'From the reviewer', author: 'reviewer' },
              { body: 'Answered by the agent', author: 'agent' },
            ],
          },
          toolValue(response.body),
        );
        check(
          'nothing waits for the agent any more',
          '[]',
          toolText(
            (await session.read(toolCall(session, 7, 'list_comments', {})))
              .body,
          ),
        );
      },
    }),
    defineCase({
      name: 'resolve_comment',
      setup: reviewerThread,
      request: (session, threadId) =>
        toolCall(session, 8, 'resolve_comment', { threadId, resolved: true }),
      async expect({ response, state, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial('a tool answer', answered(8), response.body);
        checkPartial(
          'the thread is resolved',
          { id: state, resolved: true },
          toolValue(response.body),
        );
        checkPartial(
          'a reviewer sees it resolved',
          [{ id: state, resolved: true }],
          threadWith(await threads(session), state),
        );
      },
    }),
    defineCase({
      name: 'a directory outside every registered worktree',
      setup: review,
      request: (session) => [
        toolCall(session, 9, 'read_review', { cwd: session.projectHome }),
        toolCall(session, 10, 'publish_review', {
          ...sampleReview(session, 1, randomUUID(), randomUUID()),
          cwd: session.projectHome,
        }),
      ],
      async expect({ responses, state, session, check, checkPartial }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 200, response.status);
          checkPartial(
            `request ${index + 1} is a tool error`,
            { result: { isError: true } },
            response.body,
          );
          check(
            `request ${index + 1} error body`,
            outside,
            toolValue(response.body),
          );
        }
        const after = record((await review(session)).review);
        check(
          'the revision did not move',
          record(state.review).revision,
          after.revision,
        );
        check(
          'the layers are the same',
          record(state.review).layers,
          after.layers,
        );
      },
    }),
  ],
});
