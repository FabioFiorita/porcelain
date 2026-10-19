import { execFile } from 'node:child_process';
import { createServer, type Socket } from 'node:net';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { Schema } from 'effect';
import { ServerHandle, Recorder } from '@porcelain/server/kit/isolated-server';
import {
  commitReviewFixture,
  sampleReview,
  read,
  toolCall,
  toolValue,
} from '@porcelain/server/kit/requests';
import { record, text } from '@porcelain/server/kit/session';

const execute = promisify(execFile);
const requestSchema = Schema.Struct({
  args: Schema.Array(Schema.String),
  token: Schema.optional(Schema.String),
});
function permitted(args: readonly string[]): boolean {
  if (args[0] === 'auth' && args[1] === 'status')
    return (
      JSON.stringify(args) ===
      JSON.stringify([
        'auth',
        'status',
        '--hostname',
        'github.com',
        '--json',
        'hosts',
        '--jq',
        '[.hosts["github.com"][]?.login]',
      ])
    );
  if (args[0] === 'auth' && args[1] === 'token')
    return (
      args.length === 6 &&
      args[2] === '--hostname' &&
      args[3] === 'github.com' &&
      args[4] === '--user' &&
      ['FabioFiorita', 'fpontes-soap'].includes(args[5] ?? '')
    );
  if (args[0] !== 'api' || args[1] !== '--hostname' || args[2] !== 'github.com')
    return false;
  if (args[3] === 'repos/FabioFiorita/porcelain')
    return args.length === 6 && args[4] === '--method' && args[5] === 'GET';
  return (
    args[3] === 'graphql' &&
    args[4] === '--method' &&
    args[5] === 'POST' &&
    args[6] === '-f' &&
    /^query=query PullRequest(?:Read|List)\(/.test(args[7] ?? '') &&
    args[8] === '-f' &&
    args[9] === 'owner=FabioFiorita' &&
    args[10] === '-f' &&
    args[11] === 'repo=porcelain' &&
    (args.length === 12 ||
      (args.length === 14 && args[12] === '-F' && args[13] === 'number=423'))
  );
}

export async function liveGitHubRead(manifestPath: string, logFile: string) {
  const handle = await ServerHandle.attach(manifestPath);
  const recorder = new Recorder();
  const session = handle.session(recorder, await handle.sampleIds());
  const manifest = record(JSON.parse(await readFile(manifestPath, 'utf8')));
  const socketPath = join(session.projectHome, 'gh-read.sock');
  const executable = join(text(manifest.bin), 'gh');
  const tokens = new Set<string>();
  const sockets = new Set<Socket>();
  const bridge = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let pending = '';
    socket.on('data', (chunk: Buffer) => {
      pending += chunk.toString('utf8');
      if (!pending.endsWith('\n')) return;
      socket.pause();
      void (async () => {
        const { args, token } = Schema.decodeUnknownSync(
          Schema.fromJsonString(requestSchema),
        )(pending);
        if (!permitted(args))
          throw new Error('The live fixture only permits its GitHub reads');
        const env = { ...process.env };
        for (const name of [
          'GH_TOKEN',
          'GITHUB_TOKEN',
          'GH_DEBUG',
          'GH_HOST',
          'GH_REPO',
        ])
          delete env[name];
        if (token !== undefined) {
          env.GH_TOKEN = token;
          tokens.add(token);
        }
        const { stdout } = await execute('gh', args, {
          env,
          timeout: 15000,
          maxBuffer: 4 * 1024 * 1024,
        });
        if (args[0] === 'auth' && args[1] === 'token')
          tokens.add(stdout.trim());
        socket.end(JSON.stringify({ code: 0, stdout, stderr: '' }));
      })().catch(() =>
        socket.end(
          JSON.stringify({
            code: 1,
            stdout: '',
            stderr: 'Live GitHub read failed',
          }),
        ),
      );
    });
  });
  await new Promise<void>((resolve, reject) => {
    bridge.once('error', reject);
    bridge.listen(socketPath, resolve);
  });
  let installed = false;
  try {
    await writeFile(
      executable,
      `#!${process.execPath}
import { connect } from 'node:net';
const socket = connect(${JSON.stringify(socketPath)});
socket.on('connect', () => socket.write(JSON.stringify({ args: process.argv.slice(2), ...(process.env.GH_TOKEN === undefined ? {} : { token: process.env.GH_TOKEN }) }) + '\\n'));
let response = '';
socket.on('data', chunk => response += chunk.toString('utf8'));
socket.on('end', () => { const value = JSON.parse(response); process.stdout.write(value.stdout); process.stderr.write(value.stderr); process.exitCode = value.code; });
socket.on('error', () => { process.stderr.write('GitHub fixture bridge unavailable'); process.exitCode = 1; });
`,
      { mode: 0o755, flag: 'wx' },
    );
    installed = true;
    await session.git(
      'remote',
      'add',
      'origin',
      'git@github.com:FabioFiorita/porcelain.git',
    );
    await session.git('branch', 'porcelain-fixture-base');
    await commitReviewFixture(session);
    const published = record(
      toolValue(
        await read(
          session,
          toolCall(session, 1, 'publish_review', {
            ...sampleReview(session, 0, randomUUID(), randomUUID()),
            pullRequest: 'https://github.com/FabioFiorita/porcelain/pull/423',
          }),
        ),
      ),
    );
    const reviewId = text(published.reviewId);
    const accounts = await read(session, {
      method: 'GET',
      path: `/api/projects/${session.projectId}/github-account`,
    });
    const pullRequest = await read(session, {
      method: 'GET',
      path: `/api/reviews/${reviewId}/pull-request`,
    });
    const pullRequests = await read(session, {
      method: 'GET',
      path: `/api/projects/${session.projectId}/pull-requests`,
    });
    const result = {
      origin: 'git@github.com:FabioFiorita/porcelain.git',
      accounts,
      pullRequest,
      pullRequests,
      credentialTransport:
        'temporary local Unix socket to host gh; tokens held only in memory and per-call environments',
    };
    const serialized = JSON.stringify(result);
    const logs = await readFile(logFile, 'utf8');
    for (const token of tokens)
      if (token && (serialized.includes(token) || logs.includes(token)))
        throw new Error('A token appeared in the live result');
    if (
      record(record(accounts).choice).account !== 'FabioFiorita' ||
      record(pullRequest).kind !== 'available' ||
      record(pullRequests).kind !== 'available'
    )
      throw new Error(`The live GitHub read was unavailable: ${serialized}`);
    return result;
  } finally {
    if (installed) await rm(executable, { force: true });
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => bridge.close(() => resolve()));
    await rm(socketPath, { force: true });
  }
}
