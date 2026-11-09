import { expect, it } from 'vitest';
import { humanTranscript } from './filesystem-transcript-reader.ts';
const line = (entry: unknown) => JSON.stringify(entry);
it('reads only human Claude text from the exact worktree and skips sidechains, meta, tool results and injected session scaffolding', () => {
  const entry = {
    type: 'user',
    cwd: '/repo/worktree',
    message: { content: 'Keep it simple' },
  };
  const lines = [
    entry,
    { ...entry, cwd: '/repo/other' },
    { ...entry, isMeta: true },
    { ...entry, isSidechain: true },
    { ...entry, type: 'assistant' },
    {
      ...entry,
      message: {
        content: [
          { type: 'tool_result', text: 'Tool secret' },
          { type: 'text', text: 'Ship it' },
        ],
      },
    },
    { ...entry, message: { content: '<task-notification>agent output' } },
  ].map(line);
  expect(humanTranscript(lines, '/repo/worktree', 'claude')).toBe(
    'Keep it simple\n\n---\n\nShip it',
  );
});
it('matches Codex metadata by exact folder and excludes subagents and non-human entries', () => {
  const meta = {
    type: 'session_meta',
    payload: { cwd: '/repo/worktree', source: 'cli' },
  };
  const user = {
    type: 'event_msg',
    payload: { type: 'user_message', message: 'Build the small version' },
  };
  expect(
    humanTranscript(
      [
        meta,
        user,
        { ...user, payload: { type: 'agent_message', message: 'Agent text' } },
      ].map(line),
      '/repo/worktree',
      'codex',
    ),
  ).toBe('Build the small version');
  expect(
    humanTranscript(
      [
        {
          ...meta,
          payload: { ...meta.payload, source: { subagent: { parent: 'id' } } },
        },
        user,
      ].map(line),
      '/repo/worktree',
      'codex',
    ),
  ).toBe('');
  expect(
    humanTranscript([meta, user].map(line), '/repo/worktree-nested', 'codex'),
  ).toBe('');
});
it('caps human text at 40000 characters and treats missing or malformed transcripts as normal', () => {
  const messages = Array.from({ length: 20 }, () =>
    line({
      type: 'user',
      cwd: '/repo',
      message: { content: 'x'.repeat(6000) },
    }),
  );
  expect(humanTranscript(messages, '/repo', 'claude')).toHaveLength(40000);
  expect(humanTranscript(['{', '{}'], '/repo', 'claude')).toBe('');
});
