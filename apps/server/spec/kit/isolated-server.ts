import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import {
  open,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import {
  isRecord,
  list,
  record,
  text,
  type DraftedCommit,
  type Fixture,
  type PerfSample,
  type HttpRequest,
  type HttpResponse,
  type LiveConnection,
  type LiveOptions,
  type Phase,
  type Session,
} from './session.ts';

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
  durationMs?: number;
  git?: GitProcesses;
};
export type GitProcesses = {
  processes: number;
  commands: { argv: string[]; ms: number | null }[];
};
type GitStep = {
  phase: Phase;
  kind: 'git';
  args: string[];
  output?: string;
  error?: string;
};
type FileStep = {
  phase: Phase;
  kind: 'write' | 'read';
  path: string;
  bytes: number;
};
type LinkStep = { phase: Phase; kind: 'link'; path: string; target: string };
type FifoStep = { phase: Phase; kind: 'fifo' | 'remove'; path: string };
type RenameStep = { phase: Phase; kind: 'rename'; from: string; to: string };
type InstallStep = {
  phase: Phase;
  kind: 'install';
  command: string;
  target: string;
};
type EntriesStep = {
  phase: Phase;
  kind: 'entries';
  path: string;
  names: string[];
};
type LiveStep = {
  phase: Phase;
  kind: 'live';
  via: 'credential' | 'ticket';
  origin: string | undefined;
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
  | RenameStep
  | InstallStep
  | EntriesStep
  | LiveStep;

type Manifest = {
  address: string;
  repository: string;
  socketPath: string;
  credentialFile: string;
  hitsFile: string;
  gitTrace: string | null;
  bin: string;
  installation: string;
  codingTool: string;
  fixture: Fixture;
  routes: string[];
};

export type Hit = {
  method: string;
  route: string | undefined;
  path: string;
  kit: boolean;
  status: number | undefined;
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
const repositoryOptions = /^(?:-C|--git-dir|--work-tree|--namespace)(?:=|$)/;
const READY_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;

export class Recorder {
  phase: Phase = 'setup';
  steps: Step[] = [];
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

function draftedCommitOf(value: unknown): DraftedCommit {
  const commit = record(value);
  return { message: text(commit.message), paths: list(commit.paths).map(text) };
}

function perfSampleOf(value: unknown): PerfSample | null {
  if (value === null || value === undefined) return null;
  const sample = record(value);
  return {
    files: Number(sample.files),
    commits: Number(sample.commits),
    worktrees: list(sample.worktrees).map(text),
    projects: list(sample.projects).map(text),
  };
}

function gitProcessesOf(trace: string): GitProcesses {
  const starts = new Map<string, string[]>();
  const elapsed = new Map<string, number>();
  for (const line of trace.split('\n')) {
    if (line === '') continue;
    const event = record(JSON.parse(line));
    const sid = text(event.sid);
    if (event.event === 'start') starts.set(sid, list(event.argv).map(text));
    if (event.event === 'exit' && typeof event.t_abs === 'number')
      elapsed.set(sid, Math.round(event.t_abs * 1000));
  }
  return {
    processes: starts.size,
    commands: [...starts].map(([sid, argv]) => ({
      argv,
      ms: elapsed.get(sid) ?? null,
    })),
  };
}

function traceSize(trace: string): number {
  return existsSync(trace) ? statSync(trace).size : 0;
}

async function traceSince(trace: string, from: number): Promise<GitProcesses> {
  const size = traceSize(trace);
  if (size <= from) return gitProcessesOf('');
  const file = await open(trace, 'r');
  try {
    const slice = Buffer.alloc(size - from);
    await file.read(slice, 0, slice.length, from);
    const written = slice.toString('utf8');
    return gitProcessesOf(written.slice(0, written.lastIndexOf('\n') + 1));
  } finally {
    await file.close();
  }
}

function fixtureOf(value: unknown): Fixture {
  const fixture = record(value);
  const codingTool = record(fixture.codingTool);
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
    liveTicketLifetimeMs: Number(fixture.liveTicketLifetimeMs),
    gitActionDeadlineMs: Number(fixture.gitActionDeadlineMs),
    inventoryStaleAfterMs: Number(fixture.inventoryStaleAfterMs),
    perf: perfSampleOf(fixture.perf),
    codingTool: {
      command: text(codingTool.command),
      message: draftedCommitOf(codingTool.message),
      groups: list(codingTool.groups).map(draftedCommitOf),
    },
  };
}

function manifestOf(value: unknown): Manifest {
  const manifest = record(value);
  return {
    address: text(manifest.address),
    repository: text(manifest.repository),
    socketPath: text(manifest.socketPath),
    credentialFile: text(manifest.credentialFile),
    hitsFile: text(manifest.hitsFile),
    gitTrace: typeof manifest.gitTrace === 'string' ? manifest.gitTrace : null,
    bin: text(manifest.bin),
    installation: text(manifest.installation),
    codingTool: text(manifest.codingTool),
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
      READY_TIMEOUT_MS,
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

async function readManifest(manifestPath: string): Promise<{
  manifest: Manifest;
  credential: string;
  desktopCredential: string;
}> {
  const manifest = manifestOf(JSON.parse(await readFile(manifestPath, 'utf8')));
  const secret = record(
    JSON.parse(await readFile(manifest.credentialFile, 'utf8')),
  );
  if (typeof secret.credential !== 'string' || secret.credential === '')
    throw new Error('Isolated server wrote no credential');
  if (
    typeof secret.desktopCredential !== 'string' ||
    secret.desktopCredential === ''
  )
    throw new Error('Isolated server wrote no desktop session credential');
  return {
    manifest,
    credential: secret.credential,
    desktopCredential: secret.desktopCredential,
  };
}

function hitsOf(lines: string): (Hit & { owner: boolean })[] {
  const requests = new Map<string, Hit & { owner: boolean }>();
  for (const line of lines.split('\n').filter(Boolean)) {
    const entry = record(JSON.parse(line));
    const id = text(entry.id);
    if (entry.event === 'request')
      requests.set(id, {
        method: text(entry.method),
        route: typeof entry.route === 'string' ? entry.route : undefined,
        path: text(entry.path),
        kit: entry.kit === true,
        status: undefined,
        owner: entry.owner === true,
      });
    const hit = requests.get(id);
    if (entry.event === 'response' && hit && typeof entry.status === 'number')
      hit.status = entry.status;
  }
  return [...requests.values()];
}

export class ServerHandle {
  readonly address: string;
  readonly repository: string;
  readonly projectHome: string;
  readonly installation: string;
  readonly socketPath: string;
  readonly credential: string;
  readonly desktopCredential: string;
  readonly fixture: Fixture;
  readonly routes: readonly string[];
  readonly gitTrace: string | null;
  private readonly hitsFile: string;
  private readonly bin: string;
  private readonly codingTool: string;

  protected constructor(
    manifest: Manifest,
    credentials: { credential: string; desktopCredential: string },
  ) {
    this.address = manifest.address;
    this.repository = manifest.repository;
    this.projectHome = resolve(manifest.repository, '..');
    this.installation = manifest.installation;
    this.socketPath = manifest.socketPath;
    this.fixture = manifest.fixture;
    this.routes = manifest.routes;
    this.gitTrace = manifest.gitTrace;
    this.hitsFile = manifest.hitsFile;
    this.bin = manifest.bin;
    this.codingTool = manifest.codingTool;
    this.credential = credentials.credential;
    this.desktopCredential = credentials.desktopCredential;
  }

  static async attach(manifestPath: string): Promise<ServerHandle> {
    const { manifest, ...credentials } = await readManifest(manifestPath);
    return new ServerHandle(manifest, credentials);
  }

  async sampleIds(): Promise<{ projectId: string; worktreeId: string }> {
    const inventory = await this.read(new Recorder(), {
      method: 'GET',
      path: '/api/inventory',
    });
    const [project, ...others] = list(record(inventory.body).projects).map(
      record,
    );
    const worktree = list(project?.worktrees)
      .map(record)
      .find((entry) => entry.main === true);
    if (
      others.length > 0 ||
      typeof project?.id !== 'string' ||
      typeof worktree?.id !== 'string'
    )
      throw new Error('The sample inventory is not one registered project');
    return { projectId: project.id, worktreeId: worktree.id };
  }

  private async allHits() {
    return existsSync(this.hitsFile)
      ? hitsOf(await readFile(this.hitsFile, 'utf8'))
      : [];
  }

  async hits(): Promise<Hit[]> {
    return (await this.allHits()).flatMap(({ owner, ...hit }) =>
      owner ? [] : [hit],
    );
  }

  async requestedRoutes(): Promise<string[]> {
    return [
      ...new Set(
        (await this.allHits()).flatMap((hit) =>
          hit.route === undefined
            ? []
            : [`${hit.owner ? 'owner ' : ''}${hit.method} ${hit.route}`],
        ),
      ),
    ].sort();
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
      installation: this.installation,
      projectId: ids.projectId,
      worktreeId: ids.worktreeId,
      send: (request) => this.send(recorder, request),
      read: (request, status) => this.read(recorder, request, status),
      live: (options) => this.live(recorder, options),
      secret: (value) => recorder.secret(value),
      git: async (subcommand, ...options) => {
        const refused = options.find((option) =>
          repositoryOptions.test(option),
        );
        if (refused !== undefined)
          throw new Error(
            `session.git runs in the sample repository; ${refused} is refused`,
          );
        for (const option of options)
          for (const path of [option, option.split('=').slice(1).join('=')])
            if (path.startsWith('/')) inside(path, this.projectHome);
        const args = ['-C', this.repository, subcommand, ...options];
        const step: GitStep = { phase: recorder.phase, kind: 'git', args };
        recorder.steps.push(step);
        try {
          const { stdout } = await execute('git', args, {
            cwd: this.projectHome,
            env: gitEnv,
          });
          step.output = stdout;
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
          kind: 'write',
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
          kind: 'read',
          path,
          bytes: Buffer.byteLength(content),
        });
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
      rename: async (from, to) => {
        await rename(
          inside(from, this.projectHome),
          inside(to, this.projectHome),
        );
        recorder.steps.push({
          phase: recorder.phase,
          kind: 'rename',
          from,
          to,
        });
      },
      entries: async (path) => {
        const names = (await readdir(inside(path, this.projectHome))).sort();
        recorder.steps.push({
          phase: recorder.phase,
          kind: 'entries',
          path,
          names,
        });
        return names;
      },
      installCodingTool: async () => {
        const { command } = this.fixture.codingTool;
        await symlink(this.codingTool, join(this.bin, command)).catch(
          (error: unknown) => {
            if (!(isRecord(error) && error.code === 'EEXIST')) throw error;
          },
        );
        recorder.steps.push({
          phase: recorder.phase,
          kind: 'install',
          command,
          target: this.codingTool,
        });
      },
    };
  }

  private headersFor(request: HttpRequest): Record<string, string> {
    const headers: Record<string, string> = { ...request.headers };
    const auth = request.auth ?? 'paired';
    if ((request.target ?? 'network') === 'owner' || auth === 'none')
      return headers;
    if (auth === 'paired') headers.authorization = `Bearer ${this.credential}`;
    else if (auth === 'desktop')
      headers.authorization = `Bearer ${this.desktopCredential}`;
    else if ('bearer' in auth) headers.authorization = `Bearer ${auth.bearer}`;
    else headers.cookie = auth.cookie;
    return headers;
  }

  send(recorder: Recorder, request: HttpRequest): Promise<HttpResponse> {
    return this.transmit(recorder, request);
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
    return response;
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
    const traced =
      this.gitTrace === null ? undefined : traceSize(this.gitTrace);
    const startedAt = performance.now();
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
      if (this.gitTrace !== null && traced !== undefined) {
        step.durationMs = Math.round(performance.now() - startedAt);
        step.git = await traceSince(this.gitTrace, traced);
      }
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
          timeout: REQUEST_TIMEOUT_MS,
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

  async live(
    recorder: Recorder,
    options?: LiveOptions,
  ): Promise<LiveConnection> {
    const origin = options ? options.origin : new URL(this.address).origin;
    const step: LiveStep = {
      phase: recorder.phase,
      kind: 'live',
      via: options ? 'ticket' : 'credential',
      origin,
      opened: false,
      sent: [],
      received: [],
    };
    recorder.steps.push(step);
    const url = new URL('/api/live', this.address);
    url.protocol = 'ws:';
    if (options) {
      recorder.secret(options.ticket);
      url.searchParams.set('ticket', options.ticket);
    }
    const socket = new WebSocket(url, {
      headers: {
        ...(options ? {} : { authorization: `Bearer ${this.credential}` }),
        ...(origin === undefined ? {} : { origin }),
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
      received.push(value);
      step.received.push(value);
      wake();
    });
    socket.addEventListener('close', (event) => {
      closed = { code: event.code, reason: event.reason };
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

export class IsolatedServer extends ServerHandle {
  readonly manifestPath: string;
  private readonly child: ChildProcess;
  readonly exited: Promise<void>;
  private readonly output: { stdout: string; stderr: string };

  private constructor(
    child: ChildProcess,
    exited: Promise<void>,
    output: { stdout: string; stderr: string },
    manifestPath: string,
    read: {
      manifest: Manifest;
      credential: string;
      desktopCredential: string;
    },
  ) {
    const { manifest, ...credentials } = read;
    super(manifest, credentials);
    this.child = child;
    this.exited = exited;
    this.output = output;
    this.manifestPath = manifestPath;
  }

  static async start(
    repositoryRoot: string,
    build: string,
    sample?: 'perf',
    onOutput?: (text: string) => void,
  ): Promise<IsolatedServer> {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => name !== 'PORCELAIN_DEV_SAMPLE',
      ),
    );
    const child = spawn(
      process.execPath,
      ['apps/server/spec/kit/sandbox.ts', '--server', build],
      {
        cwd: repositoryRoot,
        env: sample ? { ...env, PORCELAIN_DEV_SAMPLE: sample } : env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const output = { stdout: '', stderr: '' };
    const exited = new Promise<void>((resolveExit) =>
      child.once('close', () => resolveExit()),
    );
    child.stderr.on('data', (chunk: Buffer) => {
      output.stderr += chunk.toString('utf8');
      onOutput?.(chunk.toString('utf8'));
    });
    child.stdout.on('data', (chunk: Buffer) =>
      onOutput?.(chunk.toString('utf8')),
    );
    try {
      const manifestPath = await waitForReady(child, output);
      return new IsolatedServer(
        child,
        exited,
        output,
        manifestPath,
        await readManifest(manifestPath),
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
        timer = setTimeout(() => resolveTimeout(false), STOP_TIMEOUT_MS);
      }),
    ]);
    if (timer) clearTimeout(timer);
    if (closed) return undefined;
    this.child.kill('SIGKILL');
    await this.exited;
    return 'Isolated server did not stop within 10 seconds';
  }
}
