import { useAtom } from '@effect/atom-react';
import { registerProject } from '@porcelain/client/projects';
import type { Connection } from '@/shared/workspace/connection';

export function useRegisterProject(connection: Connection) {
  return useAtom(registerProject(connection), { mode: 'promise' });
}
