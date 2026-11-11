import { homedir } from 'node:os';
import { join } from 'node:path';

export const claudeEnvironment = <Environment extends NodeJS.ProcessEnv>(
  environment: Environment,
  platform: NodeJS.Platform = process.platform,
  home = homedir(),
): Environment & NodeJS.ProcessEnv =>
  platform === 'darwin'
    ? { ...environment, HOME: home }
    : {
        ...environment,
        CLAUDE_CONFIG_DIR:
          environment.CLAUDE_CONFIG_DIR ?? join(home, '.claude'),
      };
