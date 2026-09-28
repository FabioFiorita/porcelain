import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVitest } from 'vitest/node';
import { PlaywrightBrowserProvider } from '@vitest/browser-playwright';
import { journeyCommands, setJourneyServer } from './journey-commands.ts';

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

export async function startBrowser(evidence: string) {
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
  );
  try {
    await runner.standalone();
    await runner.globTestSpecifications();
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
                  .filter((frame) => frame !== page.mainFrame())
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

export type BrowserRunner = Awaited<ReturnType<typeof startBrowser>>;
