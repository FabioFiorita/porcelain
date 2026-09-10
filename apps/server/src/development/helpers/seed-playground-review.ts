import { randomUUID } from 'node:crypto';
import { commentThreadsSchema } from '@porcelain/contracts/comments';
import { reviewLayersResponseSchema } from '@porcelain/contracts/review-layers';

export async function seedPlaygroundReview(
  address: string,
  token: string,
  projectId: string,
  worktreeId: string,
  commitOid: string,
  signal: AbortSignal,
) {
  const send = async (method: string, path: string, body: unknown) => {
    const response = await fetch(`${address}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok)
      throw new Error(
        `Could not seed playground review: ${method} ${path} (${response.status})`,
      );
    return response.json();
  };
  const worktree = `/worktrees/${worktreeId}`;
  const project = `/projects/${projectId}`;
  // Explicitly associate the real review-guide commit, then replace the live order.
  const committedFile = { path: 'docs/review-guide.md', scope: 'staged' };
  const historical = reviewLayersResponseSchema.parse(
    await send('PUT', `${worktree}/review-layers`, {
      expectedRevision: 0,
      layers: [
        {
          id: randomUUID(),
          title: 'Explain the review workflow',
          files: [committedFile],
        },
      ],
    }),
  );
  await send('PUT', `${project}/commits/${commitOid}/review-layers`, {
    sourceWorktreeId: worktreeId,
    sourceRevision: historical.revision,
    references: [committedFile],
  });
  await send('PUT', `${worktree}/review-layers`, {
    expectedRevision: historical.revision,
    layers: [
      {
        id: randomUUID(),
        title: 'Prepare release documentation',
        files: [
          { path: 'docs/release-checklist.md', scope: 'staged' },
          { path: 'docs/accessibility.md', scope: 'staged' },
          { path: 'README.md', scope: 'staged' },
        ],
      },
      {
        id: randomUUID(),
        title: 'Polish the board',
        files: [
          { path: 'src/styles.css', scope: 'unstaged' },
          { path: 'README.md', scope: 'unstaged' },
        ],
      },
    ],
  });
  const [thread] = commentThreadsSchema.parse(
    await send('POST', `${worktree}/comments`, {
      anchor: {
        kind: 'codeRange',
        filePath: 'src/task-store.mjs',
        startLine: 1,
        endLine: 6,
      },
      body: 'Can we confirm that an empty board reports zero completed tasks?',
    }),
  );
  if (!thread) throw new Error('Playground comment was not created');
  await send('POST', `${worktree}/comments/${thread.id}/replies`, {
    body: 'Covered by the empty-board domain test. Run node --test tests/task-store.spec.mjs.',
  });
  await send('PUT', `${project}/file-preferences`, {
    path: 'src',
    flag: 'pinned',
    value: true,
  });
  await send('PUT', `${project}/file-preferences`, {
    path: '.cache',
    flag: 'hidden',
    value: true,
  });
  await send('POST', `${worktree}/artifacts`, {
    name: 'Launch review report',
    content:
      '<!doctype html><html lang="en"><title>Launch review</title><h1>Fieldnotes launch review</h1><p>Three launch tasks; one completed.</p><ul><li>Verify narrow screen layout</li><li>Review staged release documents</li><li>Confirm empty-board task summaries</li></ul></html>',
  });
}
