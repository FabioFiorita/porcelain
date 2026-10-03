import { temporaryServerBuild } from '@porcelain/server/kit/sandbox';

export const serverBuildVariable = 'PORCELAIN_E2E_SERVER_BUILD';

export function serverBuild(): string {
  const folder = process.env[serverBuildVariable];
  if (folder === undefined)
    throw new Error(
      'The Playwright global setup builds the server once before any worker starts.',
    );
  return folder;
}

export default async function globalSetup() {
  const build = await temporaryServerBuild();
  process.env[serverBuildVariable] = build.folder;
  return build.remove;
}
