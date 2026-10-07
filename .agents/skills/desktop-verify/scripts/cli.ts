import { Schema } from 'effect';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { connectionCard } from '../../verify-core/connection.ts';
import {
  refuseMissing,
  runCli,
  stopOutput,
  Usage,
} from '../../verify-core/cli.ts';
import { Registry } from '../../verify-core/registry.ts';
import {
  desktopConnectionSchema,
  desktopInputs,
  desktopProblems,
  startDesktop,
} from './start.ts';

const usage = `Usage: .agents/skills/desktop-verify/scripts/cli <command> [--instance <id>]
  start                   stage and launch unpackaged Porcelain Dev with a disposable profile and sample repository
  doctor                  check startup dependencies; list live instances and optional drivers
  status                  inspect ownership, staleness and passive renderer window targets
  logs                    print app, supervisor and server logs
  evidence                print the retained evidence folder (after stop, requires --instance)
  stop                    stop only this instance's captured processes; keep evidence
Drive the renderer through the published CDP endpoint or Computer Use.
For main/bridge journeys import startDesktop from start.ts; it returns the raw ElectronApplication and card.
`;
const targetSchema = Schema.Array(
  Schema.Struct({
    type: Schema.String,
    title: Schema.String,
    url: Schema.String,
  }),
);
const registry = new Registry({
  name: 'desktop',
  cli: import.meta.url,
  detail: desktopConnectionSchema,
  inputs: desktopInputs,
  format: 'text',
  connection: (instance) => instance.detail,
  stale: (_instance, changed) =>
    changed
      ? 'The desktop, web, server or CLI code changed since start; stop and start again.'
      : undefined,
  stopWithinMs: 30_000,
});

async function serve(folder: string) {
  await registry.serve(folder, async (life) => {
    const opened = await startDesktop({
      id: life.id,
      folder,
      evidenceDirectory: life.evidence().folder,
      sourceFingerprint: registry.fingerprint(),
      own: life.own,
      onStop: life.onStop,
    });
    opened.electron.on('close', () => {
      if (!life.stopping()) life.stop('Porcelain Dev exited');
    });
    await life
      .evidence()
      .note(
        '000-start.txt',
        connectionCard(opened.card, join(folder, 'connection.json')),
      );
    return opened.card;
  });
}

async function main(args: readonly string[]): Promise<string> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { instance: { type: 'string' } },
    allowPositionals: true,
  });
  const [command, ...rest] = positionals;
  if (command === 'serve' && rest[0] !== undefined) {
    await serve(rest[0]);
    return '';
  }
  if (command === 'start') {
    refuseMissing(desktopProblems());
    const instance = await registry.launch({}, 10 * 60_000);
    if (instance.connectionPath === undefined)
      throw new Error('The desktop published no connection file');
    return `${connectionCard(instance.detail, instance.connectionPath)}app ${instance.detail.app.productName} (${instance.detail.app.osName}, unpackaged)\nrenderer ${instance.detail.rendererUrl}\nrenderer CDP ${instance.detail.rendererCdpEndpoint}\nlifecycle ${instance.detail.electron.lifecycleEntryPoint}\n`;
  }
  if (command === 'doctor') {
    const problems = desktopProblems();
    if (problems.length > 0) process.exitCode = 1;
    return `Startup dependencies:\n${problems.length > 0 ? problems.map((problem) => `FAIL ${problem}`).join('\n') : `ready: Node ${process.versions.node}, Electron, Git, ps, pnpm and display`}\nOptional drivers:\nrenderer: CDP browser tools or Computer Use\nmain/bridge: in-process Playwright Electron\nmacOS only: Keychain, menus/sheets, window transitions\nlive instances: ${
      registry
        .list()
        .filter((entry) => entry.alive)
        .map((entry) => entry.instance.id)
        .join(', ') || 'none'
    }\n`;
  }
  if (command === 'stop')
    return stopOutput(await registry.stopById(values.instance));
  if (command === 'evidence')
    return `${registry.evidencePath(values.instance)}\n`;
  if (command !== 'status' && command !== 'logs') throw new Usage(usage);
  const instance = registry.chosen(values.instance);
  if (command === 'logs') {
    const paths = [
      join(instance.evidence, 'supervisor.log'),
      join(instance.evidence, 'electron.log'),
      join(instance.detail.app.profilePath, 'logs/server.log'),
    ];
    const output: string[] = [];
    for (const path of paths)
      if (existsSync(path))
        output.push(`${path}\n${await readFile(path, 'utf8')}`);
    return registry.redactor(instance).text(output.join('\n'));
  }
  const status = await registry.status(values.instance);
  const response = await fetch(
    `${instance.detail.rendererCdpEndpoint}/json/list`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!response.ok)
    throw new Error(`CDP window status: HTTP ${response.status}`);
  const windows = Schema.decodeUnknownSync(targetSchema)(
    await response.json(),
  ).filter((target) => target.type === 'page');
  const output = `${JSON.stringify({ ...status, app: instance.detail.app, windows }, null, 2)}\n`;
  await registry.evidence(instance).record('status', args, output);
  return output;
}

await runCli(main);
