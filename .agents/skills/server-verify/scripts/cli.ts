import { readFile } from 'node:fs/promises';
import { connect } from 'node:net';
import {
  type Recorder,
  ServerHandle,
} from '../../../../apps/server/spec/kit/isolated-server.ts';
import {
  gitSubcommands,
  type GitSubcommand,
  type Session,
} from '../../../../apps/server/spec/kit/session.ts';
import { runCli, sandboxProblems, Usage } from '../../verify-core/cli.ts';
import { registry, STALE_BUILD, type ServerInstance } from './instance.ts';
import { serve, start } from './start.ts';

const methods = [
  'GET',
  'HEAD',
  'OPTIONS',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;
const usage = `Usage: .agents/skills/server-verify/scripts/cli <command> [--instance <id>]
  start                                   build the checkout's server, start one sandboxed instance and pair with it
  doctor                                  check the tools, that the instance is ours and answers, and that its build is current
  stop                                    stop what start started, remove its data and credential, keep the evidence
  evidence                                print the evidence folder
  request <METHOD> <path> [field=value | field:=json ...] [--owner] [--anonymous]
                                          send a request with the credential; {project} {worktree} {repository} {home} are filled
                                          query parameters go in the quoted path: GET "/api/projects/folders?path={home}"
                                          field=value pairs build the JSON body, not the query
  live --for <duration> [--path <path> ...]
                                          record the live notices for the sample project and worktree, such as --for 10s
  git <subcommand> [args...]              run Git in the sample repository
  file <path>                             read a file in the sample repository
  ids                                     list the placeholder values
  logs                                    print the server's output
`;

type Driving = {
  instance: ServerInstance;
  session: Session;
  recorder: Recorder;
  visible: (text: string) => string;
};

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  const [, value] = args.splice(at, 2);
  if (value === undefined) throw new Usage(`${name} takes a value`);
  return value;
}

function options(args: string[], name: string): string[] {
  const values: string[] = [];
  let value = option(args, name);
  while (value !== undefined) {
    values.push(value);
    value = option(args, name);
  }
  return values;
}

function flag(args: string[], name: string): boolean {
  const at = args.indexOf(name);
  if (at !== -1) args.splice(at, 1);
  return at !== -1;
}

function placeholders(instance: ServerInstance): Record<string, string> {
  return {
    project: instance.detail.projectId,
    worktree: instance.detail.worktreeId,
    repository: instance.detail.repository,
    home: instance.detail.projectHome,
  };
}

function filled(text: string, instance: ServerInstance): string {
  const values = placeholders(instance);
  const result = text.replace(
    /\{([a-z]+)\}/g,
    (match, name: string) => values[name] ?? match,
  );
  const unknown = /\{([a-z]+)\}/.exec(result);
  if (unknown)
    throw new Usage(
      `unknown placeholder ${unknown[0]}; ids lists ${Object.keys(values)
        .map((name) => `{${name}}`)
        .join(' ')}`,
    );
  return result;
}

function bodyOf(fields: readonly string[], instance: ServerInstance) {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    const json = /^([^=:]+):=(.*)$/s.exec(field);
    const text = /^([^=:]+)=(.*)$/s.exec(field);
    if (json?.[1] !== undefined && json[2] !== undefined) {
      const parsed: unknown = JSON.parse(filled(json[2], instance));
      body[json[1]] = parsed;
    } else if (text?.[1] !== undefined && text[2] !== undefined)
      body[text[1]] = filled(text[2], instance);
    else
      throw new Usage(
        `${field} is not field=value or field:=json; the pairs build a JSON body`,
      );
  }
  return fields.length === 0 ? undefined : body;
}

function durationOf(value: string | undefined): number {
  const match = /^(\d+)(ms|s|m)$/.exec(value ?? '');
  if (!match?.[1] || !match[2])
    throw new Usage('live takes --for <duration>, such as 500ms, 10s or 2m');
  const unit = { ms: 1, s: 1000, m: 60_000 }[match[2]] ?? 1;
  return Number(match[1]) * unit;
}

function shown(value: unknown): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function isMethod(value: string): value is (typeof methods)[number] {
  return methods.some((method) => method === value);
}

function isGitSubcommand(value: string): value is GitSubcommand {
  return gitSubcommands.some((name) => name === value);
}

function answering(address: string): Promise<boolean> {
  const { hostname, port } = new URL(address);
  return new Promise((resolve) => {
    const socket = connect({ host: hostname, port: Number(port) });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function finish(
  instance: ServerInstance,
  name: string,
  recorder: Recorder,
  record: Record<string, unknown>,
) {
  const file = await registry.evidence(instance).json(name, record, recorder);
  process.stderr.write(`evidence: ${file}\n`);
}

function driven(
  name: string,
  requested: string | undefined,
  argv: readonly string[],
  work: (driving: Driving) => Promise<{ output: string; record: object }>,
): Promise<string> {
  const instance = registry.chosen(requested);
  const started = performance.now();
  return registry.drive(instance, argv, async () => {
    const recorder = registry.redactor(instance).recorder();
    const handle = await ServerHandle.attach(instance.detail.manifestPath);
    const session = handle.session(recorder, {
      projectId: instance.detail.projectId,
      worktreeId: instance.detail.worktreeId,
    });
    const visible = (text: string) => registry.redactor(instance).known(text);
    const { output, record } = await work({
      instance,
      session,
      recorder,
      visible,
    });
    await finish(instance, name, recorder, {
      command: argv,
      durationMs: Math.round(performance.now() - started),
      ...record,
      steps: recorder.steps,
    });
    return output;
  });
}

async function doctor(
  requested: string | undefined,
  argv: readonly string[],
): Promise<string> {
  const started = performance.now();
  const missing = sandboxProblems();
  const instance = registry.chosen(requested);
  const recorder = registry.redactor(instance).recorder();
  const handle = await ServerHandle.attach(instance.detail.manifestPath);
  const health = await handle
    .send(recorder, { method: 'GET', path: '/api/health', auth: 'none' })
    .then((response) => response.status)
    .catch(() => 0);
  const checks = [
    {
      check: 'the instance process is the one start started',
      ok: registry.alive(instance),
    },
    {
      check: `the port answers at ${instance.detail.address}`,
      ok: await answering(instance.detail.address),
    },
    { check: 'the health route answers 200', ok: health === 200 },
    {
      check: 'the build matches the checkout',
      ok: registry.fingerprint() === instance.fingerprint,
    },
  ];
  await finish(instance, 'doctor', recorder, {
    command: argv,
    durationMs: Math.round(performance.now() - started),
    missing,
    checks,
    steps: recorder.steps,
  });
  if (missing.length > 0 || checks.some((entry) => !entry.ok))
    process.exitCode = 1;
  return [
    ...missing.map((problem) => `FAIL ${problem}`),
    ...checks.map(
      ({ check, ok }) =>
        `${ok ? 'ok  ' : 'FAIL'} ${check}${ok || !check.startsWith('the build') ? '' : `: ${STALE_BUILD}`}`,
    ),
    '',
  ].join('\n');
}

async function stop(
  requested: string | undefined,
  argv: readonly string[],
): Promise<string> {
  const started = performance.now();
  const instance = registry.chosen(requested, { includeStopped: true });
  const report = await registry.stop(instance);
  await finish(instance, 'stop', registry.redactor(instance).recorder(), {
    command: argv,
    durationMs: Math.round(performance.now() - started),
    stopped: instance.id,
    report,
  });
  return `${report.map((line) => `${line}\n`).join('')}stopped ${instance.id}; evidence kept in ${instance.evidence}\n`;
}

function live(
  requested: string | undefined,
  argv: readonly string[],
  rest: string[],
): Promise<string> {
  const duration = durationOf(option(rest, '--for'));
  const paths = options(rest, '--path');
  return driven(
    'live',
    requested,
    argv,
    async ({ instance, session, visible }) => {
      const connection = await session.live();
      const until = performance.now() + duration;
      connection.send({
        type: 'subscribe',
        projects: [instance.detail.projectId],
        worktrees: [
          {
            projectId: instance.detail.projectId,
            worktreeId: instance.detail.worktreeId,
            paths,
          },
        ],
      });
      for (
        let remaining = until - performance.now();
        remaining > 0;
        remaining = until - performance.now()
      ) {
        const notice = await connection
          .next(() => true, Math.ceil(remaining))
          .catch(() => undefined);
        if (notice === undefined) break;
        process.stdout.write(`${visible(JSON.stringify(notice))}\n`);
      }
      connection.close();
      return { output: '', record: {} };
    },
  );
}

async function main(argv: readonly string[]): Promise<string> {
  const args = [...argv];
  const requested = option(args, '--instance');
  const [command, ...rest] = args;
  if (command === 'start') return start();
  if (command === 'serve' && rest[0] !== undefined) {
    await serve(rest[0]);
    return '';
  }
  if (command === 'evidence') return `${registry.chosen(requested).evidence}\n`;
  if (command === 'logs') {
    const instance = registry.chosen(requested);
    return registry
      .redactor(instance)
      .text(await readFile(instance.detail.logFile, 'utf8'));
  }
  if (command === 'doctor') return doctor(requested, argv);
  if (command === 'stop') return stop(requested, argv);
  if (command === 'live') return live(requested, argv, rest);
  if (command === 'ids')
    return driven(command, requested, argv, async ({ instance }) => {
      const values = placeholders(instance);
      return {
        output: Object.entries(values)
          .map(([name, value]) => `{${name}} ${value}\n`)
          .join(''),
        record: { values },
      };
    });
  if (command === 'request') {
    const owner = flag(rest, '--owner');
    const anonymous = flag(rest, '--anonymous');
    const [method = '', path, ...fields] = rest;
    const upper = method.toUpperCase();
    if (!isMethod(upper) || path === undefined)
      throw new Usage(
        `request takes <METHOD> <path> [field=value ...]; METHOD is one of ${methods.join(', ')}`,
      );
    return driven(
      command,
      requested,
      argv,
      async ({ instance, session, visible }) => {
        const body = bodyOf(fields, instance);
        const response = await session.send({
          method: upper,
          path: filled(path, instance),
          auth: anonymous ? 'none' : 'paired',
          target: owner ? 'owner' : 'network',
          ...(body === undefined ? {} : { body }),
        });
        return {
          output: visible(`HTTP ${response.status}\n${shown(response.body)}\n`),
          record: {},
        };
      },
    );
  }
  if (command === 'git') {
    const [subcommand = '', ...gitArgs] = rest;
    if (!isGitSubcommand(subcommand))
      throw new Usage(
        `git runs one of ${gitSubcommands.join(', ')} in the sample repository`,
      );
    return driven(command, requested, argv, async ({ session, visible }) => {
      const output = await session
        .git(subcommand, ...gitArgs)
        .catch((error: unknown) => {
          process.exitCode = 1;
          return error instanceof Error ? error.message : String(error);
        });
      return { output: visible(output), record: {} };
    });
  }
  if (command === 'file') {
    const [path] = rest;
    if (path === undefined) throw new Usage('file takes <path>');
    return driven(command, requested, argv, async ({ session, visible }) => {
      const content = await session.readFile(path);
      return { output: visible(content), record: { path, content } };
    });
  }
  throw new Usage(usage);
}

await runCli(main);
