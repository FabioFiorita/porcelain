import { expect, test } from './fixtures.ts';

test('a paired renderer reports its readiness on stderr', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  await app.window();
  await expect
    .poll(() => app.output.join('').split('\n'))
    .toContain('Porcelain: renderer ready');
});
