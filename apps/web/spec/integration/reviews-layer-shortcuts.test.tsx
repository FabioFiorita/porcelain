import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('walkthrough file shortcuts act once on the continuous document while existing context stays passive', async ({
  workspace,
  agent,
  server,
}) => {
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...values: unknown[]) => {
    warnings.push(values.map(String).join(' '));
    warn(...values);
  };
  try {
    await agent.publishArchitecture();
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
    await workspace
      .getByRole('button', {
        name: '3. Publish an immutable note',
        exact: true,
      })
      .click();
    const layer = workspace.getByRole('region', {
      name: 'Review layer Publish an immutable note',
      exact: true,
    });
    await expect
      .element(
        layer.getByRole('button', {
          name: 'Mark apps/web/src/publish-note.ts as reviewed',
          exact: true,
        }),
      )
      .toBeEnabled();
    await userEvent.keyboard('jr');
    await expect
      .poll(async () =>
        (await server.reviewedFiles()).marks.map((mark) => mark.path),
      )
      .toEqual(['packages/client/src/publish-note.ts']);
    await expect
      .poll(() =>
        warnings.filter((line) => /'[JKCR]' is already registered/.test(line)),
      )
      .toEqual([]);
  } finally {
    console.warn = warn;
  }
});
