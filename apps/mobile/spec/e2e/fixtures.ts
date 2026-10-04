import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { freemem, loadavg } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { inject, test as base } from 'vitest';
import type { Recorder } from '@porcelain/server/kit/isolated-server';
import {
  buildProblem,
  developmentClient,
  developmentLaunchUrl,
  identity,
  screenLink,
} from '../kit/development-client.ts';
import { Environment } from '../kit/environment.ts';
import { launchReadiness } from '../kit/metro.ts';
import { resetApp } from '../kit/simulator.ts';
import { runnerResources } from '../kit/runner-resources.ts';

export { expect } from 'vitest';

const execute = promisify(execFile);
const flows = import.meta.dirname;
const maestroLimitMs = 10 * 60 * 1000;
const textEvidence = /\.(?:log|json|xml|txt|html|yaml)$/;
const pairingLabel = 'Native mobile proof';

async function scrubFolder(folder: string, scrub: (text: string) => string) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) await scrubFolder(path, scrub);
    else if (textEvidence.test(entry.name))
      await writeFile(path, scrub(await readFile(path, 'utf8')));
  }
}

export type FlowResult = { name: string; status: 'passed' | 'failed' };

function reportOf(xml: string): FlowResult {
  const name = /<testcase\b[^>]*\bname="([^"]*)"/.exec(xml)?.[1];
  if (name === undefined) throw new Error('The Maestro report names no flow.');
  return {
    name: name.replaceAll('&apos;', "'").replaceAll('&amp;', '&'),
    status: /<(?:failure|error)\b/.test(xml) ? 'failed' : 'passed',
  };
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export const test = base
  .extend('device', { scope: 'worker' }, () => inject('mobileDevice'))
  .extend('serverBuild', { scope: 'worker' }, () => inject('mobileServerBuild'))
  .extend('recorders', (): Recorder[] => [])
  .extend('evidence', async ({ device, task }) => {
    const folder = join(device.evidence, slug(task.name));
    await mkdir(folder, { recursive: true });
    return folder;
  })
  .extend('resources', async ({ evidence }, { onCleanup }) => {
    const resources = runnerResources(evidence);
    onCleanup(async () => {
      try {
        await resources.snapshot('test cleanup finished');
      } finally {
        await resources.stop();
      }
    });
    await resources.snapshot('before test setup');
    return resources;
  })
  .extend(
    'environments',
    ({ serverBuild, recorders, evidence, resources }, { onCleanup }) => {
      const started: Environment[] = [];
      onCleanup(async () => {
        await resources.snapshot('before server cleanup');
        const failures = [];
        for (const environment of started) {
          try {
            const requests = (await environment.server.hits()).map(
              ({ method, route, kit, status }) => ({
                method,
                route,
                kit,
                status,
              }),
            );
            await writeFile(
              join(evidence, `requests-${slug(environment.name)}.json`),
              JSON.stringify(requests, null, 2),
            );
          } catch (error) {
            failures.push(String(error));
          }
          const failure = await environment.stop();
          if (failure) failures.push(failure);
          await resources.snapshot(`server stopped: ${environment.name}`);
        }
        if (failures.length > 0) throw new Error(failures.join('; '));
      });
      return {
        async start(title: string, options: { workspace?: boolean } = {}) {
          await resources.snapshot(`before server startup: ${title}`);
          const began = Date.now();
          const load = loadavg();
          let output = '';
          try {
            const environment = await Environment.start({
              build: serverBuild,
              title,
              label: pairingLabel,
              workspace: options.workspace ?? false,
              onOutput: (text) => {
                output = (output + text).slice(-16 * 1024);
              },
            });
            started.push(environment);
            recorders.push(environment.recorder);
            return environment;
          } finally {
            await writeFile(
              join(evidence, `environment-${title.toLowerCase()}.log`),
              recorders.reduce(
                (text, recorder) => recorder.scrub(text),
                `${new Date(began).toISOString()}: startup ${Date.now() - began}ms; load ${load.join(',')} -> ${loadavg().join(',')}; free memory ${freemem()} bytes\n${output}`,
              ),
            );
            await resources.snapshot(`after server startup: ${title}`);
          }
        },
      };
    },
  )
  .extend('app', async ({ device, evidence, recorders, resources }, hooks) => {
    const client = developmentClient();
    if (client === undefined) throw new Error(buildProblem());
    await resources.snapshot('before app reset');
    await resetApp(device.udid, client, identity.bundleIdentifier);
    await resources.snapshot('after app reset');
    const metro = await launchReadiness(
      device.metro,
      join(device.evidence, 'metro.log'),
    );
    hooks.onCleanup(metro.stop);
    const scrub = (text: string) =>
      recorders.reduce((scrubbed, recorder) => recorder.scrub(scrubbed), text);
    let runs = 0;
    return {
      async run(
        flow: string,
        variables: Record<string, string> = {},
      ): Promise<FlowResult> {
        runs += 1;
        const output = join(
          evidence,
          `${String(runs).padStart(2, '0')}-${flow.replace(/\.yaml$/, '')}`,
        );
        await mkdir(output, { recursive: true });
        await resources.snapshot(`before Maestro: ${flow}`);
        const environment = {
          DEVELOPMENT_URL: developmentLaunchUrl(device.metro),
          METRO_READY_URL: metro.url,
          ...variables,
        };
        try {
          const result = await execute(
            'maestro',
            [
              '--udid',
              device.udid,
              'test',
              join(flows, flow),
              '--test-output-dir',
              output,
              '--no-ansi',
              '--format',
              'junit',
              '--output',
              join(output, 'report.xml'),
              ...Object.entries(environment).flatMap(([name, value]) => [
                '-e',
                `${name}=${value}`,
              ]),
            ],
            {
              maxBuffer: 16 * 1024 * 1024,
              timeout: maestroLimitMs,
              env: {
                ...process.env,
                MAESTRO_CLI_NO_ANALYTICS: '1',
                MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
              },
            },
          );
          await writeFile(
            join(output, 'maestro.log'),
            scrub(result.stdout + result.stderr),
          );
        } catch (error) {
          const stdout: unknown =
            error instanceof Error ? Reflect.get(error, 'stdout') : undefined;
          const stderr: unknown =
            error instanceof Error ? Reflect.get(error, 'stderr') : undefined;
          const log = scrub(
            `${typeof stdout === 'string' ? stdout : ''}${typeof stderr === 'string' ? stderr : ''}`,
          );
          await writeFile(join(output, 'maestro.log'), log);
          await scrubFolder(output, scrub);
          throw new Error(
            `Maestro failed ${flow}; evidence in ${output}\n${log.split('\n').slice(-30).join('\n')}`,
          );
        } finally {
          await resources.snapshot(`after Maestro: ${flow}`);
        }
        await scrubFolder(output, scrub);
        return reportOf(await readFile(join(output, 'report.xml'), 'utf8'));
      },
      link: screenLink,
    };
  });
