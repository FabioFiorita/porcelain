import type { InstantSource } from '../../src/ports/instant-source.ts';

export class ScriptedInstantSource implements InstantSource {
  after(input: { instant: string; milliseconds: number }): string {
    return `${input.instant}+${input.milliseconds}`;
  }
}
