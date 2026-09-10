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
    <section
      aria-label="Mock development"
      className="flex h-full flex-wrap content-start items-center gap-2 overflow-auto bg-background p-4 text-foreground"
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
    </section>
  );
}
