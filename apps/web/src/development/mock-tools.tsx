import { useState } from 'react';
import { createMockStore, type MockScenario } from '../api/inventory/mock';
import { Button } from '../components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '../components/ui/native-select';
import {
  connectionErrorMessage,
  useConnect,
  useConnection,
} from '../query/connection';

export function MockTools() {
  const [scenario, setScenario] = useState<MockScenario>(
    window.__PORCELAIN_SCENARIO__ ?? 'populated',
  );
  const connect = useConnect();
  const { disconnect } = useConnection();
  return (
    <aside
      aria-label="Mock development"
      className="fixed bottom-20 right-3 z-30 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-xl border bg-background p-3 shadow-sm"
    >
      <span className="text-sm text-muted-foreground">Mock environment</span>
      <NativeSelect
        aria-label="Mock scenario"
        value={scenario}
        onChange={(event) => setScenario(event.target.value as MockScenario)}
      >
        {(
          [
            'populated',
            'empty',
            'unavailable',
            'slow',
            'rejected',
            'refresh-failed',
          ] as const
        ).map((value) => (
          <NativeSelectOption key={value} value={value}>
            {value}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button
        variant="outline"
        disabled={connect.isPending}
        onClick={() => {
          const store = window.__PORCELAIN_MOCK__;
          if (!store) return;
          disconnect();
          Object.assign(store, createMockStore(scenario));
          void connect.submit('mock-token').catch(() => undefined);
        }}
      >
        {connect.isPending ? 'Connecting mock…' : 'Load mock scenario'}
      </Button>
      {connect.error ? (
        <p role="alert">{connectionErrorMessage(connect.error)}</p>
      ) : null}
    </aside>
  );
}
