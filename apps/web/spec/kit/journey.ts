import { expect, test as base } from 'vitest';
import { agent } from './agent';
import { app, takeBrowserFailures, watchBrowser } from './app';
import { hostCommands } from './commands';
import { sampleRepository } from './repo';
import { server } from './server';

type Expected =
  | { kind: 'console'; pattern: RegExp; seen: boolean }
  | { kind: 'response'; route: string; status: number; seen: boolean };

let hitsSeen = 0;

watchBrowser();

async function unexpectedFailures(expected: readonly Expected[]) {
  const hits = await hostCommands.porcelainHits(hitsSeen);
  hitsSeen += hits.length;
  const found = [
    ...takeBrowserFailures().flatMap((failure) => {
      const declared = expected.find(
        (entry) =>
          entry.kind === 'console' &&
          failure.kind === 'console error' &&
          entry.pattern.test(failure.message),
      );
      if (declared) declared.seen = true;
      return declared ? [] : [`${failure.kind}: ${failure.message}`];
    }),
    ...hits
      .filter((hit) => !hit.kit && (hit.status ?? 0) >= 500)
      .flatMap((hit) => {
        const route = `${hit.method} ${hit.route ?? hit.path}`;
        const declared = expected.find(
          (entry) =>
            entry.kind === 'response' &&
            entry.route === route &&
            entry.status === hit.status,
        );
        if (declared) declared.seen = true;
        return declared
          ? []
          : [`server answered ${route} with ${hit.status ?? 0}`];
      }),
  ];
  return [
    ...found,
    ...expected
      .filter((entry) => !entry.seen)
      .map((entry) =>
        entry.kind === 'console'
          ? `declared console error ${entry.pattern} never happened`
          : `declared ${entry.status} from ${entry.route} never happened`,
      ),
  ];
}

export const test = base
  .extend('server', { scope: 'file' }, () => server)
  .extend('repo', { scope: 'file' }, () => sampleRepository())
  .extend('agent', { scope: 'file' }, () => agent)
  .extend('app', { scope: 'file' }, () => app)
  .extend('pairedPage', { scope: 'file' }, async () => {
    const paired = await app.open(await app.link('this'));
    await expect
      .element(paired.getByRole('region', { name: 'Review content' }))
      .toBeVisible();
    return paired;
  })
  .extend('unpairedPage', { scope: 'file' }, () => app.open('/'))
  .extend('failures', { auto: true }, ({ task }, { onCleanup }) => {
    const declared: Expected[] = [];
    onCleanup(async () => {
      const unexpected = await unexpectedFailures(declared);
      if (unexpected.length > 0)
        throw new Error(
          `"${task.name}" met failures it did not declare through failures.console or failures.response: ${unexpected.join('; ')}`,
        );
    });
    return {
      console: (pattern: RegExp) => {
        declared.push({ kind: 'console', pattern, seen: false });
      },
      response: (route: string, status: number) => {
        declared.push({ kind: 'response', route, status, seen: false });
      },
    };
  });
