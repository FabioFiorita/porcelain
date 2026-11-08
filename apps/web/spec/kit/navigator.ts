import type { Locator } from '@playwright/test';

export function pullRequestAction(
  navigator: Locator,
  number: number,
  project: string,
  computer: string,
) {
  const prefix = `Open PR #${number} · ${project} · ${computer} · `;
  return navigator.getByRole('button', {
    name: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  });
}
