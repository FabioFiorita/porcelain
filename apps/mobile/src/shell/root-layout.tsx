import '../app.css';
import { ShellStartup } from './shell-startup';
import { QueryProvider } from '../shared/query/provider';

export function RootLayout() {
  return (
    <QueryProvider>
      <ShellStartup />
    </QueryProvider>
  );
}
