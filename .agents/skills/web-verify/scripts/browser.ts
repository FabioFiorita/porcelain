import type { Page } from 'playwright';
import { setTimeout as sleep } from 'node:timers/promises';
import { pairingLink } from '@porcelain/contracts/access';
import type { Recorder } from '@porcelain/server/kit/isolated-server';
import { issuedLink } from '../../verify-core/fixtures.ts';
import type { WebInstance } from './instance.ts';

const pairedMs = 30_000;
const settledMs = 15_000;
const stableReads = 3;
const readEveryMs = 200;

export async function pair(
  page: Page,
  instance: WebInstance,
  recorder: Recorder,
) {
  const grant = await issuedLink(
    instance.detail.manifest,
    'Sweep browser',
    false,
    recorder,
  );
  recorder.secret(grant.code);
  await page.goto(
    `${instance.detail.web}${pairingLink({ addresses: [''], code: grant.code, environmentId: grant.environmentId })}`,
  );
  await page.waitForURL((url) => url.pathname !== '/pair' && url.hash === '', {
    timeout: pairedMs,
  });
}

export async function settledText(page: Page): Promise<string | undefined> {
  const deadline = Date.now() + settledMs;
  let last: unknown;
  let unchanged = 0;
  while (Date.now() < deadline) {
    const now: unknown = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.body.innerText;
    });
    unchanged = now === last ? unchanged + 1 : 0;
    last = now;
    if (unchanged >= stableReads && typeof now === 'string') return now;
    await sleep(readEveryMs);
  }
  return undefined;
}

export async function unavailablePage(page: Page): Promise<string | undefined> {
  const headings = await page
    .locator(
      'h1:visible, h2:visible, [role="heading"]:visible, [data-slot="breadcrumb-page"]:visible',
    )
    .allTextContents();
  return headings
    .map((text) => text.trim())
    .find((text) =>
      [
        'Page not found',
        'Computer unavailable',
        'Worktree not found',
        'Revision not found',
        'Could not display the workspace',
        'Review not found',
        'Could not display',
      ].includes(text),
    );
}
