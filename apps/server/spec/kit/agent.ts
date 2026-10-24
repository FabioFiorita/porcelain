import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import { readPublishedReviewResponseSchema } from '@porcelain/contracts/reviews';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { kitHeaders } from './isolated-server.ts';
import {
  commitReviewFixture,
  sampleReview,
  toolCall,
  toolResult,
} from './requests.ts';
import type { AgentAction, HttpRequest, Session } from './session.ts';
import { seedArchitectureSample } from './architecture-sample.ts';
import { seedStressSample } from './stress-sample.ts';

const PROOF_SCREENSHOT = 'proof-screenshot.png';
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function mainWorktree(agent: Session) {
  const response = await agent.send({
    method: 'GET',
    path: '/api/inventory',
    headers: kitHeaders,
  });
  const worktree = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    response.body,
  ).projects[0]?.worktrees.find((entry) => entry.main);
  if (worktree === undefined)
    throw new Error('The isolated server has no main worktree.');
  return worktree.id;
}

async function agentRequest(
  agent: Session,
  action: AgentAction,
): Promise<HttpRequest> {
  if (action.kind === 'publish-architecture' || action.kind === 'seed')
    throw new Error('Samples are prepared as a whole');
  if (action.kind === 'edit-file')
    return {
      method: 'POST',
      path: `/api/worktrees/${encodeURIComponent(await mainWorktree(agent))}/files`,
      body: action.edit,
    };
  const latest =
    action.kind === 'publish-proof' || action.kind === 'publish-review'
      ? (Schema.decodeUnknownSync(readPublishedReviewResponseSchema)(
          (
            await agent.read(
              {
                method: 'GET',
                path: `/api/worktrees/${await mainWorktree(agent)}/review`,
                headers: kitHeaders,
              },
              200,
            )
          ).body,
        ).review?.revision ?? 0)
      : 0;
  if (action.kind === 'publish-proof') {
    const layerId = randomUUID();
    return toolCall(agent, 1, 'publish_review', {
      ...sampleReview(agent, latest, layerId, randomUUID(), {
        title: action.title,
      }),
      proof: {
        checks: action.checks.map((check) => ({ ...check, layerId })),
        assets: [
          { kind: 'image', title: action.screenshot, path: PROOF_SCREENSHOT },
        ],
      },
    });
  }
  if (action.kind === 'reply')
    return toolCall(agent, 1, 'reply_to_comment', {
      threadId: action.threadId,
      body: action.body,
    });
  return action.kind === 'publish-review'
    ? toolCall(agent, 1, 'publish_review', {
        ...sampleReview(agent, latest, randomUUID(), randomUUID(), {
          title: action.title,
          kind: action.step,
        }),
        ...(action.summaryHtml === undefined
          ? {}
          : { summaryHtml: action.summaryHtml }),
      })
    : toolCall(agent, 1, 'create_comment', {
        ...(action.thread ?? {
          anchor: { kind: 'file', filePath: action.path },
        }),
        body: action.body,
      });
}

export async function agentActs(
  agent: Session,
  action: AgentAction,
): Promise<unknown> {
  if (action.kind === 'publish-architecture')
    return seedArchitectureSample(agent, action.reviewed ?? true);
  if (action.kind === 'seed') return seedStressSample(agent, action.variant);
  if (action.kind === 'publish-review' || action.kind === 'publish-proof') {
    await commitReviewFixture(agent);
  }
  const request = await agentRequest(agent, action);
  if (action.kind === 'publish-proof')
    await agent.writeFile(PROOF_SCREENSHOT, onePixelPng);
  const response = await agent.send({
    ...request,
    headers: { ...request.headers, ...kitHeaders },
  });
  if (action.kind === 'publish-proof') await agent.remove(PROOF_SCREENSHOT);
  if (
    response.status !== 200 ||
    (action.kind !== 'edit-file' && toolResult(response.body).isError === true)
  )
    throw new Error(
      `The agent's ${action.kind} was refused: ${JSON.stringify(response.body)}`,
    );
  return response.body;
}
