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

export function navigatorBranchIsContained(element: {
  closest(selector: string): {
    getBoundingClientRect(): { left: number; right: number };
  } | null;
  getBoundingClientRect(): { left: number; right: number };
  clientWidth: number;
  scrollWidth: number;
}) {
  const card = element.closest('[data-navigator-card]');
  if (!card) return false;
  const outer = card.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  return (
    inner.left >= outer.left &&
    inner.right <= outer.right &&
    element.clientWidth > 0 &&
    element.scrollWidth > element.clientWidth
  );
}
