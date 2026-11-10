import { record } from '../kit/session.ts';
import { walkthroughWriterSettingsSchema } from '@porcelain/contracts/walkthroughs';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import { read } from '../kit/requests.ts';
import { inventory, eventually } from '../kit/reads.ts';
import { Schema } from 'effect';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { UNKNOWN_UUID } from '../kit/answers.ts';

test('validates project walkthrough settings and reads them back in inventory', async ({
  session,
}) => {
  const path = `/api/projects/${session.projectId}/walkthrough-settings`;
  expect(
    Schema.decodeUnknownSync(walkthroughWriterSettingsSchema)(
      await read(session, { method: 'GET', path: '/api/walkthrough-settings' }),
    ).writer,
  ).toEqual({ provider: 'claude', model: 'claude-opus-5-5', effort: 'high' });
  const before = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    await inventory(session),
  );
  expect(
    before.projects.find((project) => project.id === session.projectId)
      ?.walkthroughSettings,
  ).toEqual({ mode: 'manual' });
  expect(
    await read(session, {
      method: 'PUT',
      path,
      body: {
        mode: 'automatic',
        writer: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
      },
    }),
  ).toEqual({
    mode: 'automatic',
    writer: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
  });
  expect(
    Schema.decodeUnknownSync(readInventoryResponseSchema)(
      await inventory(session),
    ).projects.find((project) => project.id === session.projectId)
      ?.walkthroughSettings,
  ).toEqual({
    mode: 'automatic',
    writer: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
  });
  expect(
    await read(session, {
      method: 'PUT',
      path,
      body: { mode: 'manual' },
    }),
  ).toEqual({ mode: 'manual' });
  expect(
    (
      await session.send({
        method: 'PUT',
        path,
        body: { mode: 'sometimes', provider: 'claude' },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await session.send({
        method: 'PUT',
        path: `/api/projects/${UNKNOWN_UUID}/walkthrough-settings`,
        body: {
          mode: 'automatic',
          writer: {
            provider: 'claude',
            model: 'claude-opus-5-5',
            effort: 'high',
          },
        },
      })
    ).status,
  ).toBe(404);
});

test('resolves request, project override, changing server default and built-in writer for manual starts', async ({
  session,
}) => {
  await session.git('branch', 'writer-base');
  const path = `/api/projects/${session.projectId}/walkthrough-settings`;
  const start = async (label: string, writer?: object) => {
    await session.writeFile('writer.txt', label);
    await session.git('add', 'writer.txt');
    await session.git('commit', '-m', label);
    return read(session, {
      method: 'POST',
      path: `/api/worktrees/${session.worktreeId}/walkthrough`,
      body: { base: 'refs/heads/writer-base', ...(writer ? { writer } : {}) },
    });
  };
  expect(
    Schema.decodeUnknownSync(walkthroughWriterSettingsSchema)(
      await read(session, { method: 'GET', path: '/api/walkthrough-settings' }),
    ).writer,
  ).toEqual({ provider: 'claude', model: 'claude-opus-5-5', effort: 'high' });
  expect((await start('Built-in')).writer).toEqual({
    provider: 'claude',
    model: 'claude-opus-5-5',
    effort: 'high',
  });
  await read(session, {
    method: 'PUT',
    path: '/api/walkthrough-settings',
    body: { provider: 'codex', model: 'fixture-model', effort: 'medium' },
  });
  expect((await start('Server default')).writer).toEqual({
    provider: 'codex',
    model: 'fixture-model',
    effort: 'medium',
  });
  await read(session, {
    method: 'PUT',
    path: '/api/walkthrough-settings',
    body: { provider: 'claude', model: 'sonnet', effort: 'low' },
  });
  expect((await start('Changed server default')).writer).toEqual({
    provider: 'claude',
    model: 'sonnet',
    effort: 'low',
  });
  await read(session, {
    method: 'PUT',
    path,
    body: {
      mode: 'manual',
      writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'xhigh' },
    },
  });
  expect((await start('Project override')).writer).toEqual({
    provider: 'claude',
    model: 'claude-opus-5-5',
    effort: 'xhigh',
  });
  expect(
    (
      await start('Request override', {
        provider: 'codex',
        model: 'request-model',
        effort: 'high',
      })
    ).writer,
  ).toEqual({ provider: 'codex', model: 'request-model', effort: 'high' });
  await read(session, { method: 'PUT', path, body: { mode: 'manual' } });
  expect((await start('Back to default')).writer).toEqual({
    provider: 'claude',
    model: 'sonnet',
    effort: 'low',
  });
});

test('refuses invalid provider effort in project, default and start contracts', async ({
  session,
}) => {
  const bad = { provider: 'claude', model: 'claude-opus-5-5', effort: 'ultra' };
  expect(
    (
      await session.send({
        method: 'PUT',
        path: '/api/walkthrough-settings',
        body: bad,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await session.send({
        method: 'PUT',
        path: `/api/projects/${session.projectId}/walkthrough-settings`,
        body: { mode: 'manual', writer: bad },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await session.send({
        method: 'POST',
        path: `/api/worktrees/${session.worktreeId}/walkthrough`,
        body: { writer: bad },
      })
    ).status,
  ).toBe(400);
});

test('records an unavailable selected model as a clear failed run without substituting a writer', async ({
  session,
}) => {
  await session.git('branch', 'missing-writer-base');
  await session.writeFile('missing-writer.txt', 'A change.');
  await session.git('add', 'missing-writer.txt');
  await session.git('commit', '-m', 'Unavailable writer fixture');
  const path = `/api/worktrees/${session.worktreeId}/walkthrough`;
  const started = await read(session, {
    method: 'POST',
    path,
    body: {
      base: 'refs/heads/missing-writer-base',
      writer: { provider: 'codex', model: 'removed-model', effort: 'high' },
    },
  });
  const result = await eventually(
    session,
    { method: 'GET', path },
    (body) => record(record(body.walkthrough).state).status === 'failed',
  );
  expect(record(result.walkthrough)).toMatchObject({
    id: started.id,
    writer: { provider: 'codex', model: 'removed-model', effort: 'high' },
    state: {
      status: 'failed',
      failure: {
        kind: 'other',
        message:
          'The walkthrough model codex/removed-model is unavailable. Install the CLI and sign in, or choose another model in walkthrough settings.',
      },
    },
  });
});
