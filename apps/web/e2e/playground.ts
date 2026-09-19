import { test } from '@playwright/test';

/**
 * Each viewport project runs against its own playground server and repository,
 * so specs that write files or move HEAD cannot disturb another project's run.
 */
export function playgroundManifest() {
  const manifest =
    test.info().project.name === 'narrow'
      ? process.env.PORCELAIN_PLAYGROUND_INFO_NARROW
      : process.env.PORCELAIN_PLAYGROUND_INFO;
  if (!manifest) throw new Error('Missing isolated playground');
  return manifest;
}
