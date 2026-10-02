import { readFile, rm, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  type Recorder,
  ServerHandle,
} from '../../../../apps/server/spec/kit/isolated-server.ts';
import {
  gitSubcommands,
  type GitSubcommand,
  type HttpRequest,
  type Session,
} from '../../../../apps/server/spec/kit/session.ts';
import {
  buildFingerprint,
  chosen,
  isOurs,
  missingTools,
  recorderFor,
  Refusal,
  STALE_BUILD,
  writeEvidence,
  type Instance,
} from './instance.ts';

const STOP_LIMIT_MS = 15_000;
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
  live --for <duration> [--path <path> ...]
                                          record the live notices for the sample project and worktree, such as --for 10s
  git <subcommand> [args...]              run Git in the sample repository
  file <path>                             read a file in the sample repository
  ids                                     list the placeholder values
  logs                                    print the server's output
`;

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  const [, value] = args.splice(at, 2);
  if (value === undefined) throw new Refusal(`${name} takes a value`);
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

function placeholders(instance: Instance): Record<string, string> {
  return {
    project: instance.projectId,
    worktree: instance.worktreeId,
    repository: instance.repository,
    home: instance.projectHome,
  };
}

function filled(text: string, instance: Instance): string {
  const values = placeholders(instance);
  const result = text.replace(
    /\{([a-z]+)\}/g,
    (match, name: string) => values[name] ?? match,
  );
  const unknown = /\{([a-z]+)\}/.exec(result);
  if (unknown)
    throw new Refusal(
      `unknown placeholder ${unknown[0]}; ids lists ${Object.keys(values)
        .map((name) => `{${name}}`)
        .join(' ')}`,
    );
  return result;
}

function bodyOf(fields: readonly string[], instance: Instance) {
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
      throw new Refusal(
        `${field} is not field=value or field:=json; the pairs build a JSON body`,
      );
  }
  return fields.length === 0 ? undefined : body;
}

function durationOf(value: string | undefined): number {
  const match = /^(\d+)(ms|s|m)$/.exec(value ?? '');
  if (!match?.[1] || !match[2])
    throw new Refusal('live takes --for <duration>, such as 500ms, 10s or 2m');
  const unit = { ms: 1, s: 1000, m: 60_000 }[match[2]] ?? 1;
  return Number(match[1]) * unit;
}

function shown(value: unknown): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

async function driven(
  requested: string | undefined,
  command: readonly string[],
): Promise<{ instance: Instance; session: Session; recorder: Recorder }> {
  const instance = await chosen(requested);
  const recorder = recorderFor(instance);
  if (buildFingerprint() !== instance.fingerprint) {
    await writeEvidence(instance, 'refused', recorder, {
      command,
      refused: STALE_BUILD,
    });
    throw new Refusal(STALE_BUILD);
  }
  await writeFile(join(instance.folder, 'last-command'), '');
  const handle = await ServerHandle.attach(instance.manifestPath);
  return {
    instance,
    recorder,
    session: handle.session(recorder, {
      projectId: instance.projectId,
      worktreeId: instance.worktreeId,
    }),
  };
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
  instance: Instance,
  name: string,
  recorder: Recorder,
  record: Record<string, unknown>,
) {
  const file = await writeEvidence(instance, name, recorder, record);
  process.stderr.write(`evidence: ${file}\n`);
}

async function main(argv: string[]): Promise<void> {
  const args = [...argv];
  const requested = option(args, '--instance');
  const [command, ...rest] = args;
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  if (command === 'start') {
    const { start } = await import('./start.ts');
    return start();
  }
  if (command === 'serve' && rest[0] !== undefined) {
    const { serve } = await import('./start.ts');
    return serve(rest[0]);
  }
  if (command === 'evidence') {
    process.stdout.write(`${(await chosen(requested)).evidence}\n`);
    return;
  }
  if (command === 'logs') {
    const instance = await chosen(requested);
    process.stdout.write(
      recorderFor(instance).scrub(await readFile(instance.logFile, 'utf8')),
    );
    return;
  }
  if (command === 'doctor') {
    const missing = missingTools();
    for (const problem of missing) process.stdout.write(`FAIL ${problem}\n`);
    const instance = await chosen(requested);
    const recorder = recorderFor(instance);
    const handle = await ServerHandle.attach(instance.manifestPath);
    const health = await handle
      .send(recorder, { method: 'GET', path: '/api/health', auth: 'none' })
      .then((response) => response.status)
      .catch(() => 0);
    const checks = [
      {
        check: 'the instance process is the one start started',
        ok: isOurs(instance.pid, instance.folder),
      },
      {
        check: `the port answers at ${instance.address}`,
        ok: await answering(instance.address),
      },
      { check: 'the health route answers 200', ok: health === 200 },
      {
        check: 'the build matches the checkout',
        ok: buildFingerprint() === instance.fingerprint,
      },
    ];
    for (const { check, ok } of checks)
      process.stdout.write(
        `${ok ? 'ok  ' : 'FAIL'} ${check}${ok || !check.startsWith('the build') ? '' : `: ${STALE_BUILD}`}\n`,
      );
    await finish(instance, 'doctor', recorder, {
      command: argv,
      durationMs: elapsed(),
      missing,
      checks,
      steps: recorder.steps,
    });
    if (missing.length > 0 || checks.some((entry) => !entry.ok))
      process.exitCode = 1;
    return;
  }
  if (command === 'stop') {
    const instance = await chosen(requested, { includeStopped: true });
    const recorder = recorderFor(instance);
    if (isOurs(instance.pid, instance.folder)) {
      process.kill(instance.pid, 'SIGTERM');
      const deadline = performance.now() + STOP_LIMIT_MS;
      while (isOurs(instance.pid, instance.folder)) {
        if (performance.now() > deadline) {
          process.kill(-instance.pid, 'SIGKILL');
          break;
        }
        await delay(50);
      }
    }
    await rm(instance.folder, { recursive: true, force: true });
    await finish(instance, 'stop', recorder, {
      command: argv,
      durationMs: elapsed(),
      stopped: instance.id,
    });
    process.stdout.write(
      `stopped ${instance.id}; evidence kept in ${instance.evidence}\n`,
    );
    return;
  }
  if (command === 'ids') {
    const { instance, recorder } = await driven(requested, argv);
    const values = placeholders(instance);
    for (const [name, value] of Object.entries(values))
      process.stdout.write(`{${name}} ${value}\n`);
    await finish(instance, 'ids', recorder, { command: argv, values });
    return;
  }
  if (command === 'request') {
    const owner = flag(rest, '--owner');
    const anonymous = flag(rest, '--anonymous');
    const [method = '', path, ...fields] = rest;
    const upper = method.toUpperCase();
    if (!isMethod(upper) || path === undefined)
      throw new Refusal(
        `request takes <METHOD> <path> [field=value ...]; METHOD is one of ${methods.join(', ')}`,
      );
    const { instance, recorder, session } = await driven(requested, argv);
    const body = bodyOf(fields, instance);
    const request: HttpRequest = {
      method: upper,
      path: filled(path, instance),
      auth: anonymous ? 'none' : 'paired',
      target: owner ? 'owner' : 'network',
      ...(body === undefined ? {} : { body }),
    };
    const response = await session.send(request);
    const visible = recorderFor(instance);
    process.stdout.write(
      visible.scrub(`HTTP ${response.status}\n${shown(response.body)}\n`),
    );
    await finish(instance, 'request', recorder, {
      command: argv,
      durationMs: elapsed(),
      steps: recorder.steps,
    });
    return;
  }
  if (command === 'live') {
    const duration = durationOf(option(rest, '--for'));
    const paths = options(rest, '--path');
    const { instance, recorder, session } = await driven(requested, argv);
    const connection = await session.live();
    const until = performance.now() + duration;
    const visible = recorderFor(instance);
    connection.send({
      type: 'subscribe',
      projects: [instance.projectId],
      worktrees: [
        {
          projectId: instance.projectId,
          worktreeId: instance.worktreeId,
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
      process.stdout.write(`${visible.scrub(JSON.stringify(notice))}\n`);
    }
    connection.close();
    await finish(instance, 'live', recorder, {
      command: argv,
      durationMs: elapsed(),
      steps: recorder.steps,
    });
    return;
  }
  if (command === 'git') {
    const [subcommand = '', ...gitArgs] = rest;
    if (!isGitSubcommand(subcommand))
      throw new Refusal(
        `git runs one of ${gitSubcommands.join(', ')} in the sample repository`,
      );
    const { instance, recorder, session } = await driven(requested, argv);
    const output = await session
      .git(subcommand, ...gitArgs)
      .catch((error: unknown) => {
        process.exitCode = 1;
        return error instanceof Error ? error.message : String(error);
      });
    process.stdout.write(recorderFor(instance).scrub(output));
    await finish(instance, 'git', recorder, {
      command: argv,
      durationMs: elapsed(),
      steps: recorder.steps,
    });
    return;
  }
  if (command === 'file') {
    const [path] = rest;
    if (path === undefined) throw new Refusal('file takes <path>');
    const { instance, recorder, session } = await driven(requested, argv);
    const content = await session.readFile(path);
    process.stdout.write(recorderFor(instance).scrub(content));
    await finish(instance, 'file', recorder, {
      command: argv,
      durationMs: elapsed(),
      path,
      content,
    });
    return;
  }
  process.stderr.write(usage);
  process.exitCode = 2;
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
