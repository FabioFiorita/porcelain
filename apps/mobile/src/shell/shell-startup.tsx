import { useAtomMount } from '@effect/atom-react';
import { shellStartup } from '../shared/application/store';
import { RootShell } from './root-shell';

export function ShellStartup() {
  useAtomMount(shellStartup);
  return <RootShell />;
}
