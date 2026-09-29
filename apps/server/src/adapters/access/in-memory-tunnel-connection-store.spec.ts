import { describe, expect, it } from 'vitest';
import { RecordingHeldConnection } from '../../../spec/fakes/recording-held-connection.ts';
import { InMemoryTunnelConnectionStore } from './in-memory-tunnel-connection-store.ts';

const tunnelHost = 'porcelain.example.com';

describe('InMemoryTunnelConnectionStore', () => {
  it('closes the connections that came through a hostname no longer answered and keeps the rest', () => {
    const store = new InMemoryTunnelConnectionStore();
    const old = new RecordingHeldConnection();
    const current = new RecordingHeldConnection();
    store.insert({ hostname: tunnelHost, connection: old });
    store.insert({ hostname: 'porcelain.example.org', connection: current });
    store.retain({ hostnames: ['porcelain.example.org'] });
    expect([old.timesClosed(), current.timesClosed()]).toEqual([1, 0]);
  });

  it('closes every connection when no hostname is answered', () => {
    const store = new InMemoryTunnelConnectionStore();
    const first = new RecordingHeldConnection();
    const second = new RecordingHeldConnection();
    store.insert({ hostname: tunnelHost, connection: first });
    store.insert({ hostname: tunnelHost, connection: second });
    store.retain({ hostnames: [] });
    expect([first.timesClosed(), second.timesClosed()]).toEqual([1, 1]);
  });

  it('closes a connection once when its hostname stays unanswered', () => {
    const store = new InMemoryTunnelConnectionStore();
    const connection = new RecordingHeldConnection();
    store.insert({ hostname: tunnelHost, connection });
    store.retain({ hostnames: [] });
    store.retain({ hostnames: [] });
    expect(connection.timesClosed()).toBe(1);
  });

  it('leaves a released connection alone', () => {
    const store = new InMemoryTunnelConnectionStore();
    const connection = new RecordingHeldConnection();
    const release = store.insert({ hostname: tunnelHost, connection });
    release();
    store.retain({ hostnames: [] });
    expect(connection.timesClosed()).toBe(0);
  });
});
