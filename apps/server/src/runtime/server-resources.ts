import { Context, ManagedRuntime } from 'effect';
import type { Layer } from 'effect';
import type { OpenedServer } from '../ports/opened-server.ts';

export class ServerComponents extends Context.Service<
  ServerComponents,
  OpenedServer
>()('@porcelain/server/ServerComponents') {}

export class ServerResources {
  private readonly runtime: ManagedRuntime.ManagedRuntime<
    ServerComponents,
    never
  >;

  constructor(resources: Layer.Layer<ServerComponents>) {
    this.runtime = ManagedRuntime.make(resources);
  }

  async open(signal: AbortSignal): Promise<OpenedServer> {
    const runtime = this.runtime;
    try {
      const components = await runtime.runPromise(ServerComponents, { signal });
      return { ...components, close: () => runtime.dispose() };
    } catch (cause) {
      await runtime.dispose().catch(() => undefined);
      throw cause;
    }
  }
}
