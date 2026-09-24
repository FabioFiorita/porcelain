import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import {
  isRecord,
  list,
  record,
  text,
  type Fixture,
  type HttpRequest,
  type HttpResponse,
  type LiveConnection,
  type Phase,
  type Session,
} from './feature.ts';
import { Provenance } from './provenance.ts';

type HttpStep = {
  phase: Phase;
  kind: 'http';
  target: 'network' | 'owner';
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: unknown;
  };
  response?: HttpResponse;
  error?: string;
};
type GitStep = {
  phase: Phase;
  kind: 'git';
  args: string[];
  output?: string;
  error?: string;
};
type FileStep = { phase: Phase; kind: 'file'; path: string; bytes: number };
type LinkStep = { phase: Phase; kind: 'link'; path: string; target: string };
type FifoStep = { phase: Phase; kind: 'fifo' | 'remove'; path: string };
type LiveStep = {
  phase: Phase;
  kind: 'live';
  opened: boolean;
  sent: unknown[];
  received: unknown[];
  closed?: { code: number; reason: string };
  error?: string;
};
export type Step =
  | HttpStep
  | GitStep
  | FileStep
  | LinkStep
  | FifoStep
  | LiveStep;

type Manifest = {
  address: string;
  repository: string;
  socketPath: string;
  credentialFile: string;
  fixture: Fixture;
  routes: string[];
};

const execute = promisify(execFile);
const quietHeaders = new Set([
  'date',
  'connection',
  'keep-alive',
  'content-length',
]);
const secretKeys = new Set([
  'credential',
  'code',
  'link',
  'signature',
  'token',
  'secret',
]);
const signedLink =
  /\/review-summaries\/([^/?#\s"]+)\?[^#\s"]*?signature=([^&#\s"]+)/g;
const issuedToken =
  /pc[a-z]_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_([A-Za-z0-9_-]{43})/g;
const setCookie = /(?:^|\n)[^=;\s]+=([^;\n]+)/g;
const readyTimeoutMs = 30_000;
const stopTimeoutMs = 10_000;
const requestTimeoutMs = 30_000;

export class Recorder {
  phase: Phase = 'setup';
  steps: Step[] = [];
  provenance = new Provenance();
  readonly cleanups: (() => void)[] = [];
  private readonly secrets = new Set<string>();

  secret(value: string) {
    if (value !== '') this.secrets.add(value);
  }

  harvest(value: unknown) {
    if (typeof value === 'string') this.harvestText(value);
    else if (Array.isArray(value))
      for (const entry of value) this.harvest(entry);
    else if (isRecord(value))
      for (const [key, entry] of Object.entries(value)) {
        this.harvestText(key);
        if (secretKeys.has(key) && typeof entry === 'string')
          this.secret(entry);
        if (key === 'set-cookie' && typeof entry === 'string')
          for (const [, cookie] of entry.matchAll(setCookie))
            if (cookie !== undefined) this.secret(cookie);
        this.harvest(entry);
      }
  }

  harvestText(value: string) {
    for (const [link, token, signature] of value.matchAll(signedLink))
      for (const secret of [link, token, signature])
        if (secret !== undefined) this.secret(secret);
    for (const [token, secret] of value.matchAll(issuedToken)) {
      this.secret(token);
      if (secret !== undefined) this.secret(secret);
    }
  }

  harvestAuth(auth: HttpRequest['auth']) {
    if (auth === undefined || typeof auth === 'string') return;
    if ('bearer' in auth) this.secret(auth.bearer);
    else {
      this.secret(auth.cookie);
      const value = auth.cookie.split('=').slice(1).join('=');
      this.secret(value);
    }
  }

  private forms(): string[] {
    return [
      ...new Set(
        [...this.secrets].flatMap((secret) => [
          secret,
          encodeURIComponent(secret),
          secret.replaceAll('&', '&amp;'),
          JSON.stringify(secret).slice(1, -1),
        ]),
      ),
    ].sort((a, b) => b.length - a.length);
  }

  scrub(value: string): string {
    let result = value;
    for (const form of this.forms())
      result = result.replaceAll(form, '[redacted]');
    return result;
  }

  redact(value: unknown): unknown {
    this.harvest(value);
    const forms = this.forms();
    const scrub = (text: string) =>
      forms.reduce(
        (result, form) => result.replaceAll(form, '[redacted]'),
        text,
      );
    const walk = (entry: unknown): unknown => {
      if (typeof entry === 'string') return scrub(entry);
      if (Array.isArray(entry)) return entry.map(walk);
      if (isRecord(entry))
        return Object.fromEntries(
          Object.entries(entry).map(([key, child]) => [
            scrub(key),
            walk(child),
          ]),
        );
      return entry;
    };
    return walk(value);
  }

  leaks(serialized: string): number {
    return [...this.secrets].filter((secret) => serialized.includes(secret))
      .length;
  }
}

function realPrefix(path: string): string {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  return parent === path ? path : join(realPrefix(parent), basename(path));
}

function headersOf(headers: IncomingHttpHeaders): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers))
    if (value !== undefined)
      result[name] = Array.isArray(value) ? value.join('\n') : value;
  return result;
}

function parseBody(raw: string, contentType: string | undefined): unknown {
  if (raw === '') return undefined;
  if (!contentType?.includes('json')) return raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed;
  } catch {
    return raw;
  }
}

function withQuery(path: string, query: HttpRequest['query']): string {
  if (!query) return path;
  const search = new URLSearchParams(
    Object.entries(query).map(([key, value]): [string, string] => [
      key,
      String(value),
    ]),
  );
  return `${path}${path.includes('?') ? '&' : '?'}${search.toString()}`;
}

function fixtureOf(value: unknown): Fixture {
  const fixture = record(value);
  const device = record(fixture.device);
  const readme = record(fixture.readme);
  const folders = record(fixture.folders);
  const web = record(fixture.web);
  const asset = record(web.asset);
  return {
    folders: {
      home: text(folders.home),
      repository: text(folders.repository),
      state: text(folders.state),
      web: text(folders.web),
    },
    branch: text(fixture.branch),
    device: { label: text(device.label), platform: text(device.platform) },
    readme: {
      path: text(readme.path),
      committed: text(readme.committed),
      changed: text(readme.changed),
    },
    initialCommit: text(fixture.initialCommit),
    web: {
      shell: text(web.shell),
      asset: { path: text(asset.path), text: text(asset.text) },
      escape: text(web.escape),
    },
    summaryLinkLifetimeMs: Number(fixture.summaryLinkLifetimeMs),
    gitActionDeadlineMs: Number(fixture.gitActionDeadlineMs),
  };
}

function manifestOf(value: unknown): Manifest {
  const manifest = record(value);
  return {
    address: text(manifest.address),
    repository: text(manifest.repository),
    socketPath: text(manifest.socketPath),
    credentialFile: text(manifest.credentialFile),
    fixture: fixtureOf(manifest.fixture),
    routes: list(manifest.routes).map(text),
  };
}

function readyManifestPath(line: string): string | undefined {
  try {
    const value: unknown = JSON.parse(line);
    return isRecord(value) && typeof value.manifest === 'string'
      ? value.manifest
      : undefined;
  } catch {
    return undefined;
  }
}

function waitForReady(
  child: ChildProcess,
  output: { stdout: string },
): Promise<string> {
  return new Promise((resolveReady, rejectReady) => {
    let pending = '';
    const timeout = setTimeout(
      () =>
        rejectReady(new Error('Isolated server was not ready in 30 seconds')),
      readyTimeoutMs,
    );
    child.once('error', (error) => {
      clearTimeout(timeout);
      rejectReady(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      rejectReady(
        new Error(`Isolated server exited before ready: ${code ?? 'signal'}`),
      );
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      const value = chunk.toString('utf8');
      output.stdout += value;
      pending += value;
      for (
        let at = pending.indexOf('\n');
        at !== -1;
        at = pending.indexOf('\n')
      ) {
        const manifest = readyManifestPath(pending.slice(0, at));
        pending = pending.slice(at + 1);
        if (manifest) {
          clearTimeout(timeout);
          resolveReady(manifest);
        }
      }
    });
  });
}

export class IsolatedServer {
  readonly address: string;
  readonly repository: string;
  readonly projectHome: string;
  readonly socketPath: string;
  readonly credential: string;
  readonly fixture: Fixture;
  readonly routes: readonly string[];
  private readonly child: ChildProcess;
  private readonly exited: Promise<void>;
  private readonly output: { stdout: string; stderr: string };

  private constructor(
    child: ChildProcess,
    exited: Promise<void>,
    output: { stdout: string; stderr: string },
    manifest: Manifest,
    credential: string,
  ) {
    this.child = child;
    this.exited = exited;
    this.output = output;
    this.address = manifest.address;
    this.repository = manifest.repository;
    this.projectHome = resolve(manifest.repository, '..');
    this.socketPath = manifest.socketPath;
    this.fixture = manifest.fixture;
    this.routes = manifest.routes;
    this.credential = credential;
  }

  static async start(
    repositoryRoot: string,
    build: string,
  ): Promise<IsolatedServer> {
    const child = spawn(
      process.execPath,
      ['scripts/dev-server.ts', '--server', build],
      {
        cwd: repositoryRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const output = { stdout: '', stderr: '' };
    const exited = new Promise<void>((resolveExit) =>
      child.once('close', () => resolveExit()),
    );
    child.stderr.on('data', (chunk: Buffer) => {
      output.stderr += chunk.toString('utf8');
    });
    try {
      const manifestPath = await waitForReady(child, output);
      const manifest = manifestOf(
        JSON.parse(await readFile(manifestPath, 'utf8')),
      );
      const secret = record(
        JSON.parse(await readFile(manifest.credentialFile, 'utf8')),
      );
      if (typeof secret.credential !== 'string' || secret.credential === '')
        throw new Error('Isolated server wrote no credential');
      return new IsolatedServer(
        child,
        exited,
        output,
        manifest,
        secret.credential,
      );
    } catch (error) {
      child.kill('SIGTERM');
      await exited;
      throw error;
    }
  }

  logs() {
    return { ...this.output };
  }

  async stop(): Promise<string | undefined> {
    this.child.kill('SIGTERM');
    let timer: NodeJS.Timeout | undefined;
    const closed = await Promise.race([
      this.exited.then(() => true),
      new Promise<false>((resolveTimeout) => {
        timer = setTimeout(() => resolveTimeout(false), stopTimeoutMs);
      }),
    ]);
    if (timer) clearTimeout(timer);
    if (closed) return undefined;
    this.child.kill('SIGKILL');
    await this.exited;
    return 'Isolated server did not stop within 10 seconds';
  }

  session(
    recorder: Recorder,
    ids: { projectId: string; worktreeId: string },
  ): Session {
    const gitEnv = {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      HOME: join(this.projectHome, 'home'),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.hooksPath',
      GIT_CONFIG_VALUE_0: '/dev/null',
      GIT_AUTHOR_NAME: 'Porcelain Verification',
      GIT_AUTHOR_EMAIL: 'verify@example.invalid',
      GIT_COMMITTER_NAME: 'Porcelain Verification',
      GIT_COMMITTER_EMAIL: 'verify@example.invalid',
      GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
    };
    const inside = (path: string, root = this.repository) => {
      const absolute = resolve(this.repository, path);
      const real = realpathSync(root);
      const reached = realPrefix(absolute);
      if (reached !== real && !reached.startsWith(`${real}${sep}`))
        throw new Error(`${path} is outside ${root}`);
      return absolute;
    };
    return {
      fixture: this.fixture,
      address: this.address,
      repository: this.repository,
      projectHome: this.projectHome,
      projectId: ids.projectId,
      worktreeId: ids.worktreeId,
      send: (request) => this.send(recorder, request),
      read: (request, status) => this.read(recorder, request, status),
      live: () => this.live(recorder),
      secret: (value) => recorder.secret(value),
      git: async (...args) => {
        const step: GitStep = { phase: recorder.phase, kind: 'git', args };
        recorder.steps.push(step);
        try {
          const { stdout } = await execute('git', args, {
            cwd: this.repository,
            env: gitEnv,
          });
          step.output = stdout;
          recorder.provenance.observe(`git ${args[0] ?? ''}`, stdout);
          return stdout;
        } catch (error) {
          step.error = error instanceof Error ? error.message : String(error);
          throw error;
        }
      },
      writeFile: async (path, content) => {
        await writeFile(inside(path), content);
        recorder.steps.push({
          phase: recorder.phase,
          kind: 'file',
          path,
          bytes:
            typeof content === 'string'
              ? Buffer.byteLength(content)
              : content.byteLength,
        });
      },
      readFile: async (path) => {
        const content = await readFile(inside(path), 'utf8');
        recorder.steps.push({
          phase: recorder.phase,
          kind: 'file',
          path,
          bytes: Buffer.byteLength(content),
        });
        recorder.provenance.observe(`file ${path}`, content);
        return content;
      },
      symlink: async (target, path) => {
        await symlink(target, inside(path));
        recorder.steps.push({
          phase: recorder.phase,
          kind: 'link',
          path,
          target,
        });
      },
      fifo: async (path) => {
        await execute('mkfifo', [inside(path)]);
        recorder.steps.push({ phase: recorder.phase, kind: 'fifo', path });
      },
      remove: async (path) => {
        await rm(inside(path), { force: true });
        recorder.steps.push({ phase: recorder.phase, kind: 'remove', path });
      },
      entries: async (path) => {
        const names = (await readdir(inside(path, this.projectHome))).sort();
        recorder.provenance.observe(`entries ${path}`, names);
        return names;
      },
    };
  }

  private headersFor(request: HttpRequest): Record<string, string> {
    const headers: Record<string, string> = { ...request.headers };
    const auth = request.auth ?? 'paired';
    if ((request.target ?? 'network') === 'owner' || auth === 'none')
      return headers;
    if (auth === 'paired') headers.authorization = `Bearer ${this.credential}`;
    else if ('bearer' in auth) headers.authorization = `Bearer ${auth.bearer}`;
    else headers.cookie = auth.cookie;
    return headers;
  }

  async send(recorder: Recorder, request: HttpRequest): Promise<HttpResponse> {
    if (recorder.phase === 'setup')
      throw new Error(
        `setup sent ${request.method} ${request.path} directly; setup reads go through read()`,
      );
    return recorder.provenance.exchange(
      recorder.phase,
      request,
      await this.transmit(recorder, request),
      false,
    );
  }

  async read(
    recorder: Recorder,
    request: HttpRequest,
    status = 200,
  ): Promise<HttpResponse> {
    const response = await this.transmit(recorder, request);
    if (response.status !== status)
      throw new Error(
        `${request.method} ${request.path} answered HTTP ${response.status}, not ${status}`,
      );
    return recorder.provenance.exchange(
      recorder.phase,
      request,
      response,
      true,
    );
  }

  private async transmit(
    recorder: Recorder,
    request: HttpRequest,
  ): Promise<HttpResponse> {
    const target = request.target ?? 'network';
    const path = withQuery(request.path, request.query);
    const headers = this.headersFor(request);
    let payload: string | undefined;
    if (request.rawBody !== undefined) {
      payload = request.rawBody;
      if (request.contentType) headers['content-type'] = request.contentType;
    } else if (request.body !== undefined) {
      payload = JSON.stringify(request.body);
      headers['content-type'] = request.contentType ?? 'application/json';
    }
    recorder.harvest(request.body);
    recorder.harvest(request.headers ?? {});
    recorder.harvestText(path);
    recorder.harvestAuth(request.auth);
    const recordedHeaders = { ...headers };
    if (recordedHeaders.authorization)
      recordedHeaders.authorization = 'Bearer [redacted]';
    if (recordedHeaders.cookie) recordedHeaders.cookie = '[redacted]';
    const step: HttpStep = {
      phase: recorder.phase,
      kind: 'http',
      target,
      request: {
        method: request.method,
        path,
        headers: recordedHeaders,
        ...(request.rawBody !== undefined
          ? { body: request.rawBody }
          : request.body === undefined
            ? {}
            : { body: request.body }),
      },
    };
    recorder.steps.push(step);
    try {
      const response = await this.exchange(
        target,
        request.method,
        path,
        {
          ...headers,
          ...(payload === undefined
            ? {}
            : { 'content-length': String(Buffer.byteLength(payload)) }),
        },
        payload,
      );
      recorder.harvest(response.body);
      recorder.harvest(response.headers);
      const cookie = /porcelain_device=([^;]+)/.exec(
        response.headers['set-cookie'] ?? '',
      );
      if (cookie?.[1]) recorder.secret(cookie[1]);
      step.response = {
        ...response,
        headers: Object.fromEntries(
          Object.entries(response.headers).filter(
            ([name]) => !quietHeaders.has(name),
          ),
        ),
      };
      return response;
    } catch (error) {
      step.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private exchange(
    target: 'network' | 'owner',
    method: string,
    path: string,
    headers: Record<string, string>,
    payload: string | undefined,
  ): Promise<HttpResponse> {
    const url = new URL(
      path,
      target === 'network' ? this.address : 'http://owner',
    );
    return new Promise((resolveResponse, rejectResponse) => {
      const outgoing = httpRequest(
        {
          method,
          path: `${url.pathname}${url.search}`,
          headers,
          timeout: requestTimeoutMs,
          agent: false,
          ...(target === 'owner'
            ? { socketPath: this.socketPath }
            : { host: url.hostname, port: url.port }),
        },
        (incoming) => {
          const chunks: Buffer[] = [];
          incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
          incoming.on('error', rejectResponse);
          incoming.on('end', () => {
            const responseHeaders = headersOf(incoming.headers);
            resolveResponse({
              status: incoming.statusCode ?? 0,
              headers: responseHeaders,
              body: parseBody(
                Buffer.concat(chunks).toString('utf8'),
                responseHeaders['content-type'],
              ),
            });
          });
        },
      );
      outgoing.on('upgrade', (incoming, socket) => {
        socket.destroy();
        resolveResponse({
          status: incoming.statusCode ?? 101,
          headers: headersOf(incoming.headers),
          body: undefined,
        });
      });
      outgoing.on('timeout', () =>
        outgoing.destroy(new Error('Request timed out')),
      );
      outgoing.on('error', rejectResponse);
      outgoing.end(payload);
    });
  }

  async live(recorder: Recorder): Promise<LiveConnection> {
    const step: LiveStep = {
      phase: recorder.phase,
      kind: 'live',
      opened: false,
      sent: [],
      received: [],
    };
    recorder.steps.push(step);
    const url = new URL('/api/live', this.address);
    url.protocol = 'ws:';
    const socket = new WebSocket(url, {
      headers: {
        authorization: `Bearer ${this.credential}`,
        origin: new URL(this.address).origin,
      },
    });
    recorder.cleanups.push(() => socket.close());
    const received: Record<string, unknown>[] = [];
    const waiters = new Set<() => boolean>();
    let closed: { code: number; reason: string } | undefined;
    const wake = () => {
      for (const waiter of waiters) waiter();
    };
    socket.addEventListener('message', (event) => {
      const value = record(JSON.parse(String(event.data)));
      recorder.harvest(value);
      recorder.provenance.observe('live notice', value);
      received.push(value);
      step.received.push(value);
      wake();
    });
    socket.addEventListener('close', (event) => {
      closed = { code: event.code, reason: event.reason };
      recorder.provenance.observe('live close', closed);
      step.closed = closed;
      wake();
    });
    await new Promise<void>((resolveOpen, rejectOpen) => {
      socket.addEventListener('open', () => resolveOpen(), { once: true });
      socket.addEventListener(
        'error',
        () => {
          step.error = 'The live connection failed to open';
          rejectOpen(new Error(step.error));
        },
        { once: true },
      );
    });
    step.opened = true;
    const wait = <T>(
      read: () => T | undefined,
      timeoutMs: number,
      what: string,
    ) =>
      new Promise<T>((resolveWait, rejectWait) => {
        const timer = setTimeout(() => {
          waiters.delete(attempt);
          rejectWait(new Error(`Timed out waiting for ${what}`));
        }, timeoutMs);
        function attempt() {
          const value = read();
          if (value === undefined) return false;
          waiters.delete(attempt);
          clearTimeout(timer);
          resolveWait(value);
          return true;
        }
        if (!attempt()) waiters.add(attempt);
      });
    let consumed = 0;
    return {
      send(message) {
        step.sent.push(message);
        socket.send(JSON.stringify(message));
      },
      next(accept, timeoutMs = 5_000) {
        return wait(
          () => {
            for (let index = consumed; index < received.length; index += 1) {
              const notice = received[index];
              if (notice && accept(notice)) {
                consumed = index + 1;
                return notice;
              }
            }
            return undefined;
          },
          timeoutMs,
          'a live notice',
        );
      },
      closed(timeoutMs = 5_000) {
        return wait(() => closed, timeoutMs, 'the live connection to close');
      },
      close() {
        socket.close();
      },
    };
  }
}
