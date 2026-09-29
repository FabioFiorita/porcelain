import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createVitest, type Vite } from 'vitest/node';
import { PlaywrightBrowserProvider } from '@vitest/browser-playwright';
import { z } from 'zod';
import { IsolatedServer } from '../../server-verify/scripts/session.ts';
import { journeyCommands, setJourneyServer } from './journey-commands.ts';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const appSource = '/src/';
const appEntry = `${appSource}main.tsx`;

export const runRequestSchema = z.strictObject({
  spec: z.string(),
  folder: z.string(),
});

export type RunRequest = z.output<typeof runRequestSchema>;

export const runSchema = z.strictObject({
  passed: z.boolean(),
  failures: z.array(z.string()),
  durationMs: z.number(),
  hits: z.array(
    z.strictObject({
      method: z.string(),
      route: z.string().or(z.undefined()),
      path: z.string(),
      kit: z.boolean(),
      status: z.number().or(z.undefined()),
    }),
  ),
  registered: z.array(z.string()),
  output: z.string(),
});

export type Run = z.output<typeof runSchema>;

export const workerMessageSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('ready') }),
  z.strictObject({ kind: z.literal('ran'), run: runSchema }),
  z.strictObject({ kind: z.literal('broken'), message: z.string() }),
]);

function errorMessage(error: unknown): string {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('message' in error) ||
    typeof error.message !== 'string'
  )
    return String(error);
  const cause = 'cause' in error ? error.cause : undefined;
  return cause === undefined
    ? error.message
    : `${error.message}\nCaused by: ${errorMessage(cause)}`;
}

async function transformApp(
  client: Vite.DevEnvironment,
  url = appEntry,
  seen = new Set<string>(),
): Promise<void> {
  if (seen.has(url)) return;
  seen.add(url);
  await client.warmupRequest(url);
  const module = await client.moduleGraph.getModuleByUrl(url);
  if (module === undefined || module.type === 'css') return;
  await Promise.all(
    [...module.importedModules]
      .filter((imported) => imported.url.startsWith(appSource))
      .map((imported) => transformApp(client, imported.url, seen)),
  );
}

export async function startBrowser(evidence: string, output: Writable) {
  const config = fileURLToPath(
    new URL('./vitest.browser.config.ts', import.meta.url),
  );
  let address = 'http://127.0.0.1';
  const targets: ((target: string) => void)[] = [];
  const runner = await createVitest(
    {
      config,
      watch: false,
      reporters: ['default', 'json'],
      outputFile: { json: join(evidence, 'vitest.json') },
      bail: 1,
    },
    {
      server: {
        fs: { allow: [resolve('apps/web'), evidence] },
        proxy: {
          '^/(api|review-summaries)(/|$)': {
            target: address,
            ws: true,
            configure(_proxy, options) {
              options.target = address;
              targets.push((target) => {
                options.target = target;
              });
            },
          },
        },
      },
      test: {
        attachmentsDir: evidence,
        browser: {
          commands: journeyCommands,
          screenshotDirectory: join(evidence, 'screenshots'),
        },
      },
    },
    { stdout: output, stderr: output },
  );
  try {
    await runner.standalone();
    await runner.globTestSpecifications();
    for (const project of runner.projects)
      if (project.browser !== undefined)
        await transformApp(project.browser.vite.environments.client);
  } catch (error) {
    await runner.close();
    throw error;
  }
  return {
    async run(spec: string, target: string, manifest: string, folder: string) {
      address = target;
      for (const change of targets) change(target);
      setJourneyServer(manifest, folder);
      runner.config.outputFile = { json: join(folder, 'vitest.json') };
      for (const project of runner.projects) {
        runner.state.clearFiles(project, runner.state.getFilepaths());
        project.config.attachmentsDir = folder;
        project.config.browser.screenshotDirectory = join(
          folder,
          'screenshots',
        );
      }
      try {
        const result = await runner.runTestSpecifications(
          runner.getModuleSpecifications(resolve(spec)),
        );
        const modules = result.testModules.filter(
          (module) => module.moduleId === resolve(spec),
        );
        const passed =
          modules.length > 0 &&
          modules.every((module) => module.state() === 'passed') &&
          result.unhandledErrors.length === 0;
        const failures = [
          ...modules.flatMap((module) => [
            ...module.errors().map(errorMessage),
            ...[...module.children.allSuites()].flatMap((suite) =>
              suite.errors().map(errorMessage),
            ),
            ...[...module.children.allTests()].flatMap((test) => {
              const outcome = test.result();
              return outcome.state === 'passed'
                ? []
                : outcome.errors?.length
                  ? outcome.errors.map(
                      (error) => `${test.fullName}: ${errorMessage(error)}`,
                    )
                  : [`${test.fullName}: ${outcome.state}`];
            }),
          ]),
          ...result.unhandledErrors.map(errorMessage),
        ];
        return { code: passed ? 0 : 1, failures };
      } finally {
        for (const project of runner.projects) {
          const provider = project.browser?.provider;
          if (provider instanceof PlaywrightBrowserProvider) {
            for (const page of provider.pages.values()) {
              await Promise.all(
                page
                  .frames()
                  .filter((frame) => frame.parentFrame() === page.mainFrame())
                  .map((frame) => frame.goto('about:blank')),
              );
              await page.evaluate(() => {
                localStorage.clear();
                sessionStorage.clear();
              });
            }
            await Promise.all(
              [...provider.contexts.values()].map((context) =>
                context.clearCookies(),
              ),
            );
          }
        }
      }
    },
    close: () => runner.close(),
  };
}

type BrowserRunner = Awaited<ReturnType<typeof startBrowser>>;

async function runOnce(
  { spec, folder }: RunRequest,
  build: string,
  browser: BrowserRunner,
  output: { text: string },
): Promise<Run> {
  const started = performance.now();
  output.text = '';
  await mkdir(folder, { recursive: true });
  const server = await IsolatedServer.start(repositoryRoot, build);
  try {
    const result = await browser.run(
      spec,
      server.address,
      server.manifestPath,
      folder,
    );
    const reported = existsSync(join(folder, 'vitest.json'));
    const hits = await server.hits();
    await writeFile(
      join(folder, 'server.json'),
      `${JSON.stringify({ hits, logs: server.logs() }, null, 2)}\n`,
    );
    return {
      passed: reported && result.code === 0,
      failures: !reported
        ? ['Vitest wrote no report; read its output above']
        : result.code !== 0 && result.failures.length === 0
          ? [`Vitest exited with ${result.code}; read its output above`]
          : result.failures,
      durationMs: Math.round(performance.now() - started),
      hits,
      registered: [...server.routes],
      output: output.text,
    };
  } finally {
    const stopped = await server.stop();
    if (stopped !== undefined) output.text += `${stopped}\n`;
    await writeFile(join(folder, 'vitest.log'), output.text);
  }
}

function send(message: z.input<typeof workerMessageSchema>): Promise<void> {
  return new Promise((done, fail) => {
    if (process.send === undefined) {
      fail(new Error('The browser worker runs as a child of verify:web.'));
      return;
    }
    process.send(message, (error: Error | null) => {
      if (error === null) done();
      else fail(error);
    });
  });
}

async function serve(build: string, evidence: string) {
  const output = { text: '' };
  const sink = new Writable({
    write(chunk: Buffer | string, _encoding, done) {
      output.text += chunk.toString();
      done();
    },
  });
  const browser = await startBrowser(evidence, sink);
  let queue = Promise.resolve();
  process.on('message', (message: unknown) => {
    const request = runRequestSchema.parse(message);
    queue = queue.then(async () => {
      try {
        await send({
          kind: 'ran',
          run: await runOnce(request, build, browser, output),
        });
      } catch (error) {
        await send({ kind: 'broken', message: errorMessage(error) });
      }
    });
  });
  process.once('disconnect', () => {
    void queue.then(() => browser.close()).finally(() => process.exit());
  });
  await send({ kind: 'ready' });
}

if (import.meta.main) {
  const [build, evidence] = process.argv.slice(2);
  if (build === undefined || evidence === undefined)
    throw new Error('Usage: browser-runner.ts <server build> <evidence>');
  try {
    await serve(build, evidence);
  } catch (error) {
    await send({ kind: 'broken', message: errorMessage(error) });
    process.exit(1);
  }
}
