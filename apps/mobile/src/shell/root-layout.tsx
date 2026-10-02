import '../app.css';
import { RootShell } from './root-shell';
import { QueryProvider } from '../shared/query/provider';

export function RootLayout() {
  return (
    <QueryProvider>
      <RootShell />
    </QueryProvider>
  );
}
