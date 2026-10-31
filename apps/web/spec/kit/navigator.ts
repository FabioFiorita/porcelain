import type { Locator } from '@playwright/test';

declare function getComputedStyle(element: unknown): {
  readonly backgroundColor: string;
  readonly cursor: string;
};

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

export function menuPaint(item: Locator) {
  return item.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, cursor: style.cursor };
  });
}
