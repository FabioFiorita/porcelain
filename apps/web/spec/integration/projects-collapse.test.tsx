import { expect, test } from './fixtures.tsx';

test('a collapsed project stays collapsed when its computer is collapsed and reopened', async ({
  render,
  server,
}) => {
  const project = await server.project();
  const navigator = await render.navigator({ remotes: [] });
  const computer = navigator.getByRole('button', {
    name: 'This computer',
    exact: true,
  });
  const projectButton = navigator.getByRole('button', {
    name: project.name,
    exact: true,
  });
  await expect.element(projectButton).toHaveAttribute('aria-expanded', 'true');

  await projectButton.click();
  await expect.element(projectButton).toHaveAttribute('aria-expanded', 'false');

  await computer.click();
  await expect.element(computer).toHaveAttribute('aria-expanded', 'false');
  await expect.element(projectButton).not.toBeInTheDocument();

  await computer.click();
  await expect.element(computer).toHaveAttribute('aria-expanded', 'true');
  await expect.element(projectButton).toHaveAttribute('aria-expanded', 'false');
});
