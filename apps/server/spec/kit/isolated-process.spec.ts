import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { IsolatedProcess } from './isolated-process.ts';

async function listeningChild(shutdown: 'graceful' | 'stuck' | 'failed') {
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
import { createServer } from 'node:net';
const sockets = new Set();
const server = createServer(socket => {
  sockets.add(socket);
  socket.once('close', () => sockets.delete(socket));
  socket.write('connected');
});
process.on('SIGTERM', () => {
  if (${JSON.stringify(shutdown)} === 'stuck') return;
  for (const socket of sockets) socket.destroy();
  server.close(() => process.exit(${shutdown === 'failed' ? 7 : 0}));
});
server.listen(0, '127.0.0.1', () => process.send(server.address().port));
`,
    ],
    { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
  );
  const lifetime = new IsolatedProcess(child);
  const opened: unknown[] = await once(child, 'message');
  const socket = connect(Number(opened[0]), '127.0.0.1');
  const received: unknown[] = await once(socket, 'data');
  const disconnected = once(socket, 'close');
  const exit = once(child, 'exit');
  return {
    lifetime,
    socket,
    disconnected,
    exit,
    message: String(received[0]),
    cleanup: async () => {
      socket.destroy();
      child.kill('SIGKILL');
      await lifetime.exited;
    },
  };
}

it('waits for the owned live connection to close and shares successful shutdown', async () => {
  const running = await listeningChild('graceful');
  try {
    expect(running.message).toBe('connected');
    const stopping = running.lifetime.stop();
    expect(running.lifetime.stop()).toBe(stopping);
    await expect(stopping).resolves.toBeUndefined();
    await running.disconnected;
    expect(await running.exit).toEqual([0, null]);
    expect(running.socket.destroyed).toBe(true);
    await expect(running.lifetime.stop()).resolves.toBeUndefined();
  } finally {
    await running.cleanup();
  }
});

it('rejects after forcing a live peer to exit at the existing deadline and retains that failure', async () => {
  const running = await listeningChild('stuck');
  try {
    expect(running.message).toBe('connected');
    const stopping = running.lifetime.stop();
    const failure = await stopping.catch((error: unknown) => error);
    expect(failure).toEqual(
      new Error('Isolated server did not stop within 10 seconds'),
    );
    expect(await running.exit).toEqual([null, 'SIGKILL']);
    await running.disconnected;
    expect(running.socket.destroyed).toBe(true);
    expect(running.lifetime.stop()).toBe(stopping);
    await expect(running.lifetime.stop()).rejects.toBe(failure);
  } finally {
    await running.cleanup();
  }
}, 15_000);

it('retains an unsuccessful child exit even when it beats the stop deadline', async () => {
  const running = await listeningChild('failed');
  try {
    const stopping = running.lifetime.stop();
    await expect(stopping).rejects.toThrow(
      'Isolated server exited with code 7 during shutdown',
    );
    expect(await running.exit).toEqual([7, null]);
    await running.disconnected;
    expect(running.socket.destroyed).toBe(true);
    expect(running.lifetime.stop()).toBe(stopping);
    await expect(running.lifetime.stop()).rejects.toThrow('code 7');
  } finally {
    await running.cleanup();
  }
});
